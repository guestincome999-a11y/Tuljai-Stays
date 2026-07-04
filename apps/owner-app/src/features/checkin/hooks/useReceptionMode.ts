import { useCallback, useEffect, useState } from 'react';

import { loadReceptionMode, saveReceptionMode } from '../storage/reception-mode-store';

export function useReceptionMode() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const stored = await loadReceptionMode().catch(() => false);

      if (mounted) {
        setEnabled(stored);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const update = useCallback((nextEnabled: boolean) => {
    setEnabled(nextEnabled);
    void saveReceptionMode(nextEnabled);
  }, []);

  return {
    enabled,
    setEnabled: update,
  };
}
