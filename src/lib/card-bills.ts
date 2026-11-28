import type { SQLiteDatabase } from 'expo-sqlite';

import { listBillingCards, listCardMovements } from '@/db/queries';
import type { Account } from '@/db/types';
import { defaultBillMonth, summarizeBills, type Bill } from '@/lib/credit-card';

/** Um cartão e a fatura que ele mostra primeiro. */
export type CardBill = { card: Account; bill: Bill };

/**
 * Para cada cartão ativo com fechamento e vencimento: a fatura padrão, a mesma que a tela
 * do cartão abre primeiro (a última fechada se ainda falta pagar; senão, a aberta).
 * Usada na aba Contas e no card "Próximos".
 */
export async function listCardBills(db: SQLiteDatabase, today: string): Promise<CardBill[]> {
  const result: CardBill[] = [];
  for (const card of await listBillingCards(db)) {
    const billingCard = { ...card, closing_day: card.closing_day!, due_day: card.due_day! };
    const movements = await listCardMovements(db, card.id);
    const month = defaultBillMonth(billingCard, movements, today);
    const [bill] = summarizeBills(billingCard, movements, [month], today);
    result.push({ card, bill });
  }
  return result;
}

/** Fatura com valor a pagar e já fechada: aparece em "Faturas a pagar". */
export function needsPayment({ bill }: CardBill) {
  return ['closed', 'partial', 'overdue'].includes(bill.status) && bill.total > bill.paid;
}
