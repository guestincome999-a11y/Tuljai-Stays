import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Lang = 'en' | 'mr';

export interface Bilingual {
  en: string;
  mr: string;
}

const LANGUAGE_KEY = 'tuljai.pilgrim.v2.language';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Picks the current language from a bilingual pair, falling back to English if Marathi is empty. */
  t: (text: Bilingual) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => undefined,
  t: (text) => text.en,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    void SecureStore.getItemAsync(LANGUAGE_KEY)
      .then((stored) => {
        if (stored === 'en' || stored === 'mr') setLangState(stored);
      })
      .catch(() => undefined);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    void SecureStore.setItemAsync(LANGUAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLang,
      t: (text) => (lang === 'mr' && text.mr.trim().length > 0 ? text.mr : text.en),
    }),
    [lang, setLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageContextValue {
  return useContext(LanguageContext);
}

/** Reads `${key}En` / `${key}Mr` from a remote-config props object as a bilingual pair. */
export function bilingualProp(props: Record<string, unknown>, key: string): Bilingual {
  const en = props[`${key}En`];
  const mr = props[`${key}Mr`];
  return { en: typeof en === 'string' ? en : '', mr: typeof mr === 'string' ? mr : '' };
}
