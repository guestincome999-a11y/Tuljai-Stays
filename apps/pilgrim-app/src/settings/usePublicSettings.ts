import { useEffect, useState } from 'react';

import {
  isFestivalModeEnabled,
  listPublicFeatureFlags,
  listPublicSettings,
} from './public-settings-api';

export function usePublicSettings() {
  const [festivalModeEnabled, setFestivalModeEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [settings, flags] = await Promise.all([
        listPublicSettings().catch(() => []),
        listPublicFeatureFlags().catch(() => []),
      ]);

      if (mounted) {
        setFestivalModeEnabled(isFestivalModeEnabled(settings, flags));
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return { festivalModeEnabled };
}
