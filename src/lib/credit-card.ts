import { Account, Transaction } from '@/db/types';
import { addDays, addMonthsClamped, monthKey } from '@/lib/dates';
import { toBusinessDay } from './holidays';

/**
 * Regras de fatura de cartão de crédito e de compras parceladas. Só cálculo, sem banco.
 *
 * Cada fatura é identificada pelo mês em que fecha ("2026-12" = a fatura que fecha em
 * dezembro). Ela reúne as compras desde o fechamento anterior (inclusive) até a véspera
 * do seu fechamento: uma compra no próprio dia do fechamento já vai para a fatura seguinte.
 */

// ─── Datas da fatura ───────────────────────────────────────────────────────

/** Dia `day` do mês "YYYY-MM", ou o último dia se o mês for mais curto (31 → 30 ou 28). */
function dayOfMonth(month: string, day: number) {
  const [year, m] = month.split('-').map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

/** "2026-12" → "2027-01". Aceita deslocamento negativo. */
export function shiftMonth(month: string, delta: number) {
  return monthKey(addMonthsClamped(`${month}-01`, delta));
}

/** Data em que a fatura do mês fecha. */
export function closingDate(month: string, closingDay: number) {
  return dayOfMonth(month, closingDay);
}

/**
 * Data de vencimento da fatura do mês. O vencimento vem sempre depois do fechamento:
 * se o dia de vencimento é maior que o de fechamento, vence no mesmo mês; senão, no seguinte.
 * Ex.: fecha dia 3 e vence dia 10 → 03/12 e 10/12. Fecha dia 28 e vence dia 5 → 28/12 e 05/01.
 * Se o vencimento cair em fim de semana ou feriado, passa para o próximo dia útil
 * (o fechamento não muda, mesmo em dia não útil).
 */
export function dueDate(month: string, closingDay: number, dueDay: number) {
  return toBusinessDay(dayOfMonth(dueDay > closingDay ? month : shiftMonth(month, 1), dueDay), 'next');
}

/** Mês da fatura em que cai uma compra feita em `date`. */
export function billMonthOf(date: string, closingDay: number) {
  const month = monthKey(date);
  return date < closingDate(month, closingDay) ? month : shiftMonth(month, 1);
}

/** Primeiro e último dia de compras da fatura do mês (os dois inclusive). */
export function billRange(month: string, closingDay: number) {
  return {
    start: closingDate(shiftMonth(month, -1), closingDay),
    end: addDays(closingDate(month, closingDay), -1),
  };
}

// ─── Parcelas ──────────────────────────────────────────────────────────────

/** Datas das parcelas: a da compra e depois uma por mês, no mesmo dia (31 vira o último dia). */
export function installmentDates(firstDate: string, count: number) {
  return Array.from({ length: count }, (_, i) => addMonthsClamped(firstDate, i));
}

/**
 * Divide o total em parcelas de centavos inteiros. Os centavos que sobram vão para a 1ª:
 * R$ 100,00 em 3x → 33,34 + 33,33 + 33,33.
 */
export function splitInstallments(total: number, count: number) {
  const base = Math.floor(total / count);
  const amounts = Array<number>(count).fill(base);
  amounts[0] += total - base * count;
  return amounts;
}

/**
 * Valores das parcelas quando algumas foram digitadas à mão. `fixed[i]` é o valor digitado
 * para a parcela i, ou null se ela deve ser calculada. As calculadas dividem o que sobra do
 * total (com os centavos extras na primeira delas).
 * Devolve `ok: false` com a diferença quando não fecha: as fixas passam do total, ou todas
 * são fixas e a soma não bate. `difference` > 0 = falta; < 0 = passou.
 */
export function distributeInstallments(
  total: number,
  fixed: (number | null)[]
): { ok: true; amounts: number[] } | { ok: false; difference: number } {
  const fixedSum = fixed.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const free = fixed.filter((value) => value === null).length;
  const rest = total - fixedSum;

  if (free === 0) return rest === 0 ? { ok: true, amounts: fixed as number[] } : { ok: false, difference: rest };
  // Cada parcela calculada precisa de pelo menos 1 centavo.
  if (rest < free) return { ok: false, difference: rest - free };

  const split = splitInstallments(rest, free);
  let next = 0;
  return { ok: true, amounts: fixed.map((value) => value ?? split[next++]) };
}

// ─── Faturas ───────────────────────────────────────────────────────────────

/** Um movimento do cartão, como vem de `listCardMovements`. */
export type CardMovement = Pick<Transaction, 'date' | 'kind' | 'amount' | 'account_id' | 'to_account_id'>;


/**
 * - `future`: ainda não começou (só parcelas futuras);
 * - `open`: recebendo compras;
 * - `closed`: fechou e ainda não foi paga, mas não venceu;
 * - `partial`: fechou, foi paga em parte e não venceu;
 * - `overdue`: venceu sem ser paga por inteiro;
 * - `paid`: paga (ou sem nada a pagar).
 */
export type BillStatus = 'future' | 'open' | 'closed' | 'partial' | 'overdue' | 'paid';

export type Bill = {
  month: string; // "2026-12"
  start: string; // primeiro dia de compras
  end: string; // último dia de compras
  closing: string;
  due: string;
  total: number; // compras − estornos, em centavos
  paid: number; // quanto dos pagamentos cobre esta fatura
  status: BillStatus;
};

/** Cartão com fechamento e vencimento definidos. */
export type BillingCard = Pick<Account, 'id' | 'initial_balance'> & { closing_day: number; due_day: number };

/**
 * Faturas dos meses pedidos (`months` em ordem crescente), a partir de todos os movimentos do cartão.
 *
 * Compras e saques somam na fatura da data; estornos (receitas no cartão) descontam.
 * Pagamentos são as transferências para o cartão feitas até hoje, e quitam as faturas da
 * mais antiga para a mais nova. Assim, pagar a mais ou adiantado abate a fatura seguinte.
 * Um saldo inicial negativo (dívida de antes do app) é quitado primeiro.
 */
export function summarizeBills(card: BillingCard, movements: CardMovement[], months: string[], today: string): Bill[] {
  const totals = new Map<string, number>();
  let payments = Math.max(card.initial_balance, 0);
  for (const m of movements) {
    if (m.kind === 'transfer' && m.to_account_id === card.id) {
      if (m.date <= today) payments += m.amount;
      continue;
    }
    const sign = m.kind === 'income' ? -1 : 1;
    const month = billMonthOf(m.date, card.closing_day);
    totals.set(month, (totals.get(month) ?? 0) + sign * m.amount);
  }

  // Quanto de dívida existe antes de cada fatura: saldo inicial negativo + faturas anteriores.
  const sorted = [...totals.keys()].sort();
  let before = Math.max(-card.initial_balance, 0);
  const debtBefore = new Map<string, number>();
  for (const month of [...new Set([...sorted, ...months])].sort()) {
    debtBefore.set(month, before);
    before += totals.get(month) ?? 0;
  }

  return months.map((month) => {
    const { start, end } = billRange(month, card.closing_day);
    const closing = closingDate(month, card.closing_day);
    const due = dueDate(month, card.closing_day, card.due_day);
    const total = totals.get(month) ?? 0;
    const paid = total > 0 ? Math.min(Math.max(payments - (debtBefore.get(month) ?? 0), 0), total) : 0;
    let status: BillStatus;
    if (today < start) status = 'future';
    else if (today < closing) status = 'open';
    else if (paid >= total) status = 'paid';
    else if (today > due) status = 'overdue';
    else status = paid > 0 ? 'partial' : 'closed';

    return { month, start, end, closing, due, total, paid, status };
  });
}

/**
 * Quanto do limite está em uso: dívida inicial + compras (incluindo parcelas futuras)
 * − estornos − pagamentos feitos até hoje. O disponível é o limite menos isso.
 */
export function usedLimit(card: BillingCard, movements: CardMovement[], today: string) {
  let used = -card.initial_balance;
  for (const m of movements) {
    if (m.kind === 'transfer' && m.to_account_id === card.id) {
      if (m.date <= today) used -= m.amount;
    } else {
      used += m.kind === 'income' ? -m.amount : m.amount;
    }
  }
  return used;
}

/**
 * Fatura que o cartão deve mostrar primeiro: a última fechada, se ainda falta pagar;
 * senão, a aberta.
 */
export function defaultBillMonth(card: BillingCard, movements: CardMovement[], today: string) {
  const open = billMonthOf(today, card.closing_day);
  const [previous] = summarizeBills(card, movements, [shiftMonth(open, -1)], today);
  return ['closed', 'partial', 'overdue'].includes(previous.status) ? previous.month : open;
}