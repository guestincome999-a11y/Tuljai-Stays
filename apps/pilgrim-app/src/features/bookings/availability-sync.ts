import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

const listeners = new Set<(lodgeId?: string) => void>();

/** Public inventory hints carry lodge/type IDs only; no booking or guest data. */
export function notifyAvailabilityChange(lodgeId?: string): void {
  for (const listener of listeners) listener(lodgeId);
}

export function useAvailabilityRevision(lodgeId: string | undefined, enabled: boolean): number {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled || !lodgeId) return;
    const refresh = (changedLodge?: string) => {
      if (!changedLodge || changedLodge === lodgeId) setRevision((value) => value + 1);
    };
    listeners.add(refresh);
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      listeners.delete(refresh);
      foreground.remove();
    };
  }, [lodgeId, enabled]);
  return revision;
}
