import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import { listBillingCards, listCardMovements, listRecurrences } from '@/db/queries';
import type { RecurrenceRow } from '@/db/types';
import { billMonthOf, shiftMonth, summarizeBills } from '@/lib/credit-card';
import { addDays, parseISODate, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { CHANNEL_ID } from '@/lib/notifications';
import { occurrencesUntil } from '@/lib/recurrences';

/**
 * Lembretes agendados no aparelho, às 9h:
 * - recorrências com "Avisar no dia": no dia de cada ocorrência;
 * - faturas de cartão com valor a pagar: na véspera e no dia do vencimento.
 * Chegam mesmo com o app fechado.
 */

/** Prefixos dos ids, para cancelar só os lembretes (e não os avisos de orçamento). */
const ID_PREFIXES = ['recurrence:', 'bill:'];
/** Hora dos lembretes. */
const REMINDER_HOUR = 9;
/** Até quantos dias à frente agendar. O app reagenda sempre que abre, então não precisa ir longe. */
const DAYS_AHEAD = 60;
/** O iOS guarda no máximo 64 notificações agendadas por app; fica uma folga. */
const MAX_REMINDERS = 50;

type Reminder = { id: string; title: string; body: string; at: Date };

/** 9h do dia `iso`. */
function at9(iso: string) {
  const at = parseISODate(iso);
  at.setHours(REMINDER_HOUR);
  return at;
}

// ─── Agendamento ───────────────────────────────────────────────────────────

/**
 * Refaz todos os lembretes: cancela os agendados e agenda de novo. Chamada sempre que os
 * dados mudam, então editar uma recorrência, lançar uma compra ou pagar uma fatura já
 * atualiza os avisos (uma fatura paga deixa de avisar).
 */
export async function syncReminders(db: SQLiteDatabase) {
  // Cancela os lembretes antigos
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const { identifier } of scheduled) {
    if (ID_PREFIXES.some((prefix) => identifier.startsWith(prefix))) {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    }
  }

  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;

  // Só os que ainda vão acontecer; agenda os mais próximos, até o limite.
  const now = new Date();
  const reminders = [...(await recurrenceReminders(db)), ...(await billReminders(db))]
    .filter((r) => r.at > now)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_REMINDERS);

  for (const { id, title, body, at } of reminders) {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
    });
  }
}

// ─── Recorrências ──────────────────────────────────────────────────────────

/** Ocorrências futuras das recorrências ativas com "Avisar no dia". */
async function recurrenceReminders(db: SQLiteDatabase): Promise<Reminder[]> {
  const until = addDays(today(), DAYS_AHEAD);
  const result: Reminder[] = [];
  for (const rec of await listRecurrences(db)) {
    if (rec.paused || !rec.notify) continue;
    for (const { date } of occurrencesUntil(rec, rec.next_date, until)) {
      result.push({
        id: `recurrence:${rec.id}:${date}`,
        title: recurrenceTitle(rec),
        body: rec.auto
          ? 'Vence hoje. O app lança sozinho quando você abri-lo.'
          : 'Vence hoje. Abra o app para confirmar ou pular.',
        at: at9(date),
      });
    }
  }
  return result;
}

/** "Aluguel: −R$ 1.500,00" */
function recurrenceTitle(rec: RecurrenceRow) {
  const name = rec.description || (rec.kind === 'transfer' ? 'Transferência' : (rec.category_name ?? 'Recorrente'));
  const sign = rec.kind === 'income' ? '+' : rec.kind === 'expense' ? '−' : '';
  return `${name}: ${sign}${formatMoney(rec.amount)}`;
}

// ─── Faturas ───────────────────────────────────────────────────────────────

/**
 * Véspera e dia do vencimento de cada fatura com valor a pagar, de todos os cartões com
 * fechamento e vencimento. Olha da fatura anterior à aberta até duas depois dela.
 * O valor do aviso é o que falta pagar no momento do agendamento.
 */
async function billReminders(db: SQLiteDatabase): Promise<Reminder[]> {
  const now = today();
  const result: Reminder[] = [];
  for (const card of await listBillingCards(db)) {
    const billingCard = { ...card, closing_day: card.closing_day!, due_day: card.due_day! };
    const open = billMonthOf(now, billingCard.closing_day);
    const months = [-1, 0, 1, 2].map((delta) => shiftMonth(open, delta));
    const movements = await listCardMovements(db, card.id);

    for (const bill of summarizeBills(billingCard, movements, months, now)) {
      const remaining = bill.total - bill.paid;
      if (remaining <= 0) continue;
      const title = `Fatura ${card.name}: ${formatMoney(remaining)}`;
      result.push(
        { id: `bill:${card.id}:${bill.month}:eve`, title, body: 'Vence amanhã.', at: at9(addDays(bill.due, -1)) },
        { id: `bill:${card.id}:${bill.month}:due`, title, body: 'Vence hoje.', at: at9(bill.due) }
      );
    }
  }
  return result;
}
