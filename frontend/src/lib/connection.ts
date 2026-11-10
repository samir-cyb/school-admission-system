import { useSyncExternalStore } from "react";

/**
 * "Can we reach the API?" — flipped by the React Query caches on every success/failure,
 * read by the offline banner. A tiny external store keeps it outside React state churn.
 */
let offline = false;
const listeners = new Set<() => void>();

export function setOffline(next: boolean): void {
  if (offline === next) return;
  offline = next;
  listeners.forEach((l) => l());
}

export function useOffline(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => offline,
    () => false,
  );
}
