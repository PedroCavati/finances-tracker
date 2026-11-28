import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useDataVersion } from '@/db/events';
import { syncReminders } from '@/lib/reminders';
import { runDueRecurrences } from '@/lib/recurrences';

/** Espera os dados pararem de mudar antes de reagendar os lembretes. */
const REMINDER_SYNC_DELAY_MS = 1000;

/**
 * Gera os lançamentos recorrentes que venceram sempre que o app volta para a tela,
 * caso tenha ficado aberto em segundo plano de um dia para o outro. Não desenha nada.
 * Agenda as notificações dos lançamentos recorrentes.
 */
export function RecurrenceRunner() {
  const db = useSQLiteContext();
  const version = useDataVersion();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') runDueRecurrences(db).catch(() => { });
    });
    return () => subscription.remove();
  }, [db]);

  // Vários salvamentos seguidos viram um só reagendamento.
  useEffect(() => {
    const timer = setTimeout(() => {
      syncReminders(db).catch(() => { });
    }, REMINDER_SYNC_DELAY_MS)
    return () => clearTimeout(timer);
  }, [db, version]);

  return null;
}