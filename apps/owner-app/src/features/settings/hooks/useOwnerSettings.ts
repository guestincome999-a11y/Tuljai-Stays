import { useCallback, useEffect, useState } from 'react';

import {
  defaultOwnerSettings,
  loadOwnerSettings,
  saveOwnerSettings,
  type OwnerOperationalSettings,
} from '../storage/owner-settings-store';

export function useOwnerSettings() {
  const [settings, setSettings] = useState<OwnerOperationalSettings>(defaultOwnerSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadOwnerSettings()
      .then(setSettings)
      .finally(() => setIsLoading(false));
  }, []);

  const update = useCallback(
    async (patch: Partial<OwnerOperationalSettings>) => {
      const nextSettings = { ...settings, ...patch };
      setSettings(nextSettings);
      await saveOwnerSettings(nextSettings);
      setSuccessMessage('Settings saved on this device.');
    },
    [settings],
  );

  return {
    isLoading,
    setSuccessMessage,
    settings,
    successMessage,
    update,
  };
}
