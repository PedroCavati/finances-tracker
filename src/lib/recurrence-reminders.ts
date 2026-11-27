import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import { listRecurrences } from '@/db/queries';
import type { RecurrenceRow } from '@/db/types';
import { addDays, parseISODate, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { CHANNEL_ID } from '@/lib/notifications';
import { occurrencesUntil } from '@/lib/recurrences';

/** Prefixo dos lembretes de recorrência, para cancelar só eles (e não outros avisos). */
const ID_PREFIX = 'recurrence:';
/** Hora do lembrete no dia da ocorrência. */
const REMINDER_HOUR = 9;
/** Até quantos dias à frente agendar. O app reagenda sempre que abre, então não precisa ir longe. */
const DAYS_AHEAD = 60;
/** O iOS guarda no máximo 64 notificações agendadas por app; fica uma folga. */
const MAX_REMINDERS = 50;

/**
 * Refaz os lembretes das recorrências com "Avisar no dia": cancela os agendados e agenda
 * de novo, às 9h da data real de cada ocorrência. Chamada sempre que os dados mudam,
 * então editar, pausar, confirmar ou apagar uma recorrência já atualiza os lembretes.
 */
export async function syncRecurrenceReminders(db: SQLiteDatabase) {
  // Cancela os lembretes antigos
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const { identifier } of scheduled) {
    if (identifier.startsWith(ID_PREFIX)) await Notifications.cancelScheduledNotificationAsync(identifier);
  }

  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;

  // Ocorrências futuras das recorrências ativas que pedem lembrete
  const now = new Date();
  const until = addDays(today(), DAYS_AHEAD);
  const reminders: { rec: RecurrenceRow; date: string; at: Date }[] = [];
  for (const rec of await listRecurrences(db)) {
    if (rec.paused || !rec.notify) continue;
    for (const { date } of occurrencesUntil(rec, rec.next_date, until)) {
      const at = parseISODate(date);
      at.setHours(REMINDER_HOUR);
      if (at > now) reminders.push({ rec, date, at });
    }
  }

  // Agenda as mais próximas, até o limite
  reminders.sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const { rec, date, at } of reminders.slice(0, MAX_REMINDERS)) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}${rec.id}:${date}`,
      content: { title: reminderTitle(rec), body: reminderBody(rec) },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
    });
  }
}

/** "Aluguel: −R$ 1.500,00" */
function reminderTitle(rec: RecurrenceRow) {
  const name = rec.description || (rec.kind === 'transfer' ? 'Transferência' : (rec.category_name ?? 'Recorrente'));
  const sign = rec.kind === 'income' ? '+' : rec.kind === 'expense' ? '−' : '';
  return `${name}: ${sign}${formatMoney(rec.amount)}`;
}

/** Automática: o app lança ao abrir. Com confirmação: o usuário precisa confirmar. */
function reminderBody(rec: RecurrenceRow) {
  return rec.auto
    ? 'Vence hoje. O app lança sozinho quando você abri-lo.'
    : 'Vence hoje. Abra o app para confirmar ou pular.';
}
