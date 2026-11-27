import type { SQLiteDatabase } from 'expo-sqlite';

import { notifyDataChanged } from '@/db/events';
import {
  insertRecurrenceTransaction,
  listDueRecurrences,
  listRecurrences,
  saveTransaction,
  setRecurrenceNextDate,
} from '@/db/queries';
import type { Frequency, Recurrence, RecurrenceRow, TransactionInput } from '@/db/types';
import { checkBudgetAlert } from '@/lib/budget-alerts';
import { addDays, addMonthsClamped, monthRange, parseISODate, today } from '@/lib/dates';
import { nthBusinessDay, toBusinessDay } from '@/lib/holidays';

// ─── Datas ─────────────────────────────────────────────────────────────────

/** Campos de uma recorrência que definem as datas. */
type Schedule = Pick<Recurrence, 'frequency' | 'anchor_date' | 'business_days' | 'business_day_n'>;

/** Folga para a regra "dia útil anterior", que pode antecipar uma ocorrência em alguns dias. */
const PREVIOUS_RULE_MARGIN_DAYS = 7;

/**
 * Próxima ocorrência depois de `current`. Mensal e anual contam a partir de `anchor`,
 * para o dia 31 voltar a ser 31 depois de fevereiro.
 */
export function nextOccurrence(frequency: Frequency, anchor: string, current: string) {
  if (frequency === 'weekly') return addDays(current, 7);

  const [anchorYear, anchorMonth] = anchor.split('-').map(Number);
  const [year, month] = current.split('-').map(Number);
  const monthsSinceAnchor = (year - anchorYear) * 12 + (month - anchorMonth);
  return addMonthsClamped(anchor, monthsSinceAnchor + (frequency === 'monthly' ? 1 : 12));
}

/** Data real de uma ocorrência: aplica o "Nº dia útil" ou o ajuste para dia útil. */
export function actualDate(schedule: Schedule, nominal: string) {
  if (schedule.business_day_n) return nthBusinessDay(nominal, schedule.business_day_n);
  if (schedule.business_days !== 'none') return toBusinessDay(nominal, schedule.business_days);
  return nominal;
}

/**
 * Ocorrências a partir da data nominal `fromNominal` cuja data real cai até `until`.
 * Cada item traz a data nominal (para avançar a recorrência) e a real (para o lançamento).
 */
export function occurrencesUntil(schedule: Schedule, fromNominal: string, until: string) {
  const result: { nominal: string; date: string }[] = [];
  for (let nominal = fromNominal; ;) {
    const date = actualDate(schedule, nominal);
    if (date > until) return result;
    result.push({ nominal, date });
    nominal = nextOccurrence(schedule.frequency, schedule.anchor_date, nominal);
  }
}

// ─── Geração automática ────────────────────────────────────────────────────

/**
 * Cria os lançamentos das recorrências automáticas que já venceram e avança cada uma.
 * Pode ser chamada várias vezes: a leitura é feita dentro da transação, então duas
 * execuções ao mesmo tempo não geram o mesmo lançamento duas vezes.
 */
export async function runDueRecurrences(db: SQLiteDatabase) {
  const now = today();
  let generated = 0;
  const generatedExpenses: { categoryId: number | null; date: string }[] = [];

  await db.withExclusiveTransactionAsync(async (tx) => {
    // A margem pega as que a regra "anterior" antecipa para antes da data nominal.
    const candidates = await listDueRecurrences(tx, addDays(now, PREVIOUS_RULE_MARGIN_DAYS), true);
    for (const rec of candidates) {
      const due = occurrencesUntil(rec, rec.next_date, now);
      if (due.length === 0) continue;
      for (const { date } of due) {
        await insertRecurrenceTransaction(tx, rec, date);
        generated += 1;
        if (rec.kind === 'expense') generatedExpenses.push({ categoryId: rec.category_id, date });
      }
      const lastNominal = due[due.length - 1].nominal;
      await setRecurrenceNextDate(tx, rec.id, nextOccurrence(rec.frequency, rec.anchor_date, lastNominal));
    }
  });

  if (generated === 0) return;
  notifyDataChanged();
  // Fora da transação: o aviso consulta o banco e pode pedir notificação.
  for (const { categoryId, date } of generatedExpenses) {
    await checkBudgetAlert(db, categoryId, date).catch(() => { });
  }
}

// ─── Pendentes, próximos e previsto ────────────────────────────────────────

/** Uma ocorrência que ainda não virou lançamento. */
export type Occurrence = { rec: RecurrenceRow; nominal: string; date: string };

/**
 * Ocorrências de recorrências com confirmação que já venceram, só a mais antiga de cada uma.
 * Elas precisam ser resolvidas em ordem: confirmar ou pular avança a recorrência.
 */
export async function listPendingConfirmations(db: SQLiteDatabase): Promise<Occurrence[]> {
  const now = today();
  const pending: Occurrence[] = [];
  for (const rec of await listRecurrences(db)) {
    if (rec.paused || rec.auto) continue;
    const [first] = occurrencesUntil(rec, rec.next_date, now);
    if (first) pending.push({ rec, ...first });
  }
  return pending.sort((a, b) => a.date.localeCompare(b.date));
}

/** Ocorrências de todas as recorrências ativas com data real entre amanhã e `days` dias à frente. */
export async function listUpcoming(db: SQLiteDatabase, days: number): Promise<Occurrence[]> {
  const now = today();
  const until = addDays(now, days);
  const upcoming: Occurrence[] = [];
  for (const rec of await listRecurrences(db)) {
    if (rec.paused) continue;
    for (const occurrence of occurrencesUntil(rec, rec.next_date, until)) {
      if (occurrence.date > now) upcoming.push({ rec, ...occurrence });
    }
  }
  return upcoming.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Despesas recorrentes previstas no mês e ainda não lançadas (futuras e pendentes de
 * confirmação), somadas por categoria principal. Base do "previsto" no orçamento.
 */
export async function committedByCategory(db: SQLiteDatabase, month: string) {
  const { start, end } = monthRange(`${month}-01`);
  const totals = new Map<number, number>();
  for (const rec of await listRecurrences(db)) {
    if (rec.paused || rec.kind !== 'expense' || rec.budget_category_id === null) continue;
    const inMonth = occurrencesUntil(rec, rec.next_date, end).filter((o) => o.date >= start);
    if (inMonth.length === 0) continue;
    const id = rec.budget_category_id;
    totals.set(id, (totals.get(id) ?? 0) + inMonth.length * rec.amount);
  }
  return totals;
}

/**
 * Lança a ocorrência (com os dados que o usuário confirmou ou ajustou) e avança a recorrência.
 * Feito numa transação: ou as duas coisas acontecem, ou nenhuma.
 */
export async function confirmOccurrence(
  db: SQLiteDatabase,
  rec: Recurrence,
  nominal: string,
  input: TransactionInput
) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    await saveTransaction(tx, { ...input, recurrence_id: rec.id });
    await setRecurrenceNextDate(tx, rec.id, nextOccurrence(rec.frequency, rec.anchor_date, nominal));
  });
  notifyDataChanged();
}

/** Pula a ocorrência sem lançar nada. */
export async function skipOccurrence(db: SQLiteDatabase, rec: Recurrence, nominal: string) {
  await setRecurrenceNextDate(db, rec.id, nextOccurrence(rec.frequency, rec.anchor_date, nominal));
  notifyDataChanged();
}

// ─── Pausar ───────────────────────────────────────────────────────────────────

/**
 * Pausa ou retoma. Ao retomar, as ocorrências do período pausado são descartadas:
 * a recorrência continua a partir da primeira ocorrência de hoje em diante.
 */
export async function setPaused(db: SQLiteDatabase, rec: Recurrence, paused: boolean) {
  let nextDate = rec.next_date;
  if (!paused) {
    const missed = occurrencesUntil(rec, rec.next_date, addDays(today(), -1));
    if (missed.length > 0) {
      nextDate = nextOccurrence(rec.frequency, rec.anchor_date, missed[missed.length - 1].nominal);
    }
  }
  await db.runAsync('UPDATE recurrences SET paused = ?, next_date = ? WHERE id = ?', paused ? 1 : 0, nextDate, rec.id);
  notifyDataChanged();
}

// ─── Texto ─────────────────────────────────────────────────────────────────

const WEEKDAY_NAMES = ['Todo domingo', 'Toda segunda', 'Toda terça', 'Toda quarta', 'Toda quinta', 'Toda sexta', 'Todo sábado'];

/** "Todo dia 10", "Toda segunda", "Todo ano em 10/12" ou "5º dia útil do mês", com o ajuste se houver. */
export function describeSchedule(schedule: Schedule) {
  const anchor = parseISODate(schedule.anchor_date);
  if (schedule.business_day_n) return `${schedule.business_day_n}º dia útil do mês`;

  const base =
    schedule.frequency === 'weekly'
      ? WEEKDAY_NAMES[anchor.getDay()]
      : schedule.frequency === 'monthly'
        ? `Todo dia ${anchor.getDate()}`
        : `Todo ano em ${String(anchor.getDate()).padStart(2, '0')}/${String(anchor.getMonth() + 1).padStart(2, '0')}`;

  if (schedule.business_days === 'next') return `${base} (ou dia útil seguinte)`;
  if (schedule.business_days === 'previous') return `${base} (ou dia útil anterior)`;
  return base;
}