'use client';

import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';

export type OwnerLanguage = 'en' | 'mr';

interface OwnerAppContextValue {
  language: OwnerLanguage;
  setLanguage: (language: OwnerLanguage) => void;
  t: (english: string, marathi: string) => string;
}

const OwnerAppContext = createContext<OwnerAppContextValue | null>(null);

export function OwnerAppProvider({ children }: PropsWithChildren) {
  const [language, setLanguage] = useState<OwnerLanguage>('en');
  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (english: string, marathi: string) => (language === 'mr' ? marathi : english),
    }),
    [language],
  );

  return <OwnerAppContext.Provider value={value}>{children}</OwnerAppContext.Provider>;
}

export function useOwnerApp() {
  const context = useContext(OwnerAppContext);
  if (!context) throw new Error('useOwnerApp must be used inside OwnerAppProvider');
  return context;
}
