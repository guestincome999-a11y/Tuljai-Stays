import { useEffect, useState } from 'react';

import { isFestivalModeEnabled, listPublicSettings } from './public-settings-api';

export function usePublicSettings() {
  const [festivalModeEnabled, setFestivalModeEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const settings = await listPublicSettings().catch(() => []);

      if (mounted) {
        setFestivalModeEnabled(isFestivalModeEnabled(settings));
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return { festivalModeEnabled };
}
