'use client';

import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  loadOwnerSettings,
  saveOwnerSettings,
} from '../features/settings/storage/owner-settings-store';

import { marathiTranslations } from './translations';

export type OwnerLanguage = 'en' | 'mr';

interface OwnerAppContextValue {
  language: OwnerLanguage;
  setLanguage: (language: OwnerLanguage) => void;
  t: (english: string, marathi: string) => string;
  tr: (english: string) => string;
}

const OwnerAppContext = createContext<OwnerAppContextValue | null>(null);

export function OwnerAppProvider({ children }: PropsWithChildren) {
  const [language, setLanguage] = useState<OwnerLanguage>('en');
  const [isLanguageReady, setIsLanguageReady] = useState(false);

  useEffect(() => {
    void loadOwnerSettings()
      .then((settings) => setLanguage(settings.language === 'MR' ? 'mr' : 'en'))
      .finally(() => setIsLanguageReady(true));
  }, []);

  const updateLanguage = useCallback((nextLanguage: OwnerLanguage) => {
    setLanguage(nextLanguage);
    void loadOwnerSettings().then((settings) =>
      saveOwnerSettings({ ...settings, language: nextLanguage === 'mr' ? 'MR' : 'EN' }),
    );
  }, []);
  const value = useMemo(
    () => ({
      language,
      setLanguage: updateLanguage,
      t: (english: string, marathi: string) => (language === 'mr' ? marathi : english),
      tr: (english: string) =>
        language === 'mr' ? (marathiTranslations[english] ?? english) : english,
    }),
    [language, updateLanguage],
  );

  return isLanguageReady ? (
    <OwnerAppContext.Provider value={value}>{children}</OwnerAppContext.Provider>
  ) : null;
}

export function useOwnerApp() {
  const context = useContext(OwnerAppContext);
  if (!context) throw new Error('useOwnerApp must be used inside OwnerAppProvider');
  return context;
}
