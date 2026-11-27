import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { useDataVersion } from '@/db/events';

/**
 * Roda uma consulta no banco e refaz quando `key` muda ou quando algo é gravado.
 * `key` deve representar todos os parâmetros que a consulta usa (ex.: JSON dos filtros).
 */
export function useQuery<T>(query: (db: SQLiteDatabase) => Promise<T>, key: string) {
  const db = useSQLiteContext();
  const version = useDataVersion();
  const [state, setState] = useState<{ data: T | undefined; error: Error | null; forKey: string }>(
    { data: undefined, error: null, forKey: '' }
  );

  useEffect(() => {
    let cancelled = false;
    query(db).then(
      (data) => {
        if (!cancelled) setState({ data, error: null, forKey: key });
      },
      (error: Error) => {
        if (!cancelled) setState((prev) => ({ ...prev, error, forKey: key }));
      }
    );
    return () => {
      cancelled = true;
    };
    // `query` muda a cada render; `key` e `version` representam o que importa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, key, version]);

  // `data` mantém o resultado anterior enquanto a nova consulta roda, para a tela não piscar.
  return {
    data: state.data,
    error: state.error,
    loading: state.forKey !== key && state.data === undefined,
  };
}
