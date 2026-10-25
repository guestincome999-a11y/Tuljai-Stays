import { useEffect, useState } from 'react';

import { warmUpBackend } from '../core/api';
import { hydrateConfig, refreshConfig } from '../core/config';
import { useAppFonts } from '../design/fonts';

/**
 * Resolves true once fonts are ready and the last saved design has been read from disk, so the
 * first frame already uses the latest layout and colours. A fresh copy is requested in parallel.
 */
export function useBootstrap(): boolean {
  const fontsReady = useAppFonts();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    warmUpBackend();
    void hydrateConfig().finally(() => {
      setHydrated(true);
      void refreshConfig();
    });
  }, []);

  return fontsReady && hydrated;
}
