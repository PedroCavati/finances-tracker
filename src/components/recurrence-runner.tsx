import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { runDueRecurrences } from '@/lib/recurrences';

/**
 * Gera os lançamentos recorrentes que venceram sempre que o app volta para a tela,
 * caso tenha ficado aberto em segundo plano de um dia para o outro. Não desenha nada.
 */
export function RecurrenceRunner() {
  const db = useSQLiteContext();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') runDueRecurrences(db).catch(() => {});
    });
    return () => subscription.remove();
  }, [db]);

  return null;
}