import { useSyncExternalStore } from 'react';

/**
 * Contador global que sobe a cada escrita no banco. As telas leem o valor com
 * useDataVersion() e refazem suas consultas quando ele muda.
 */
let version = 0;
const listeners = new Set<() => void>();

export function notifyDataChanged() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDataVersion() {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version
  );
}
