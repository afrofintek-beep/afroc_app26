import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import enTranslations from '@/translations/en.json';
import ptTranslations from '@/translations/pt.json';

export type Language = 'en' | 'fr' | 'pt' | 'ar' | 'am' | 'sw' | 'ln' | 'yo' | 'sn' | 'zu' | 'kmb' | 'umb' | 'kg';

type Dict = Record<string, string>;

// pt + en ficam no bundle principal: são o mercado principal E os fallbacks,
// por isso há SEMPRE tradução imediata (zero flash para pt/en, fallback sempre pronto).
const en = enTranslations as Dict;
const pt = ptTranslations as Dict;

// As restantes 11 línguas carregam DINAMICAMENTE (chunks separados) só quando
// escolhidas — poupa ~1,4 MB no primeiro carregamento (crítico p/ dados/telemóveis modestos).
const loaders: Record<Language, () => Promise<{ default: Dict }>> = {
  en: async () => ({ default: en }),
  pt: async () => ({ default: pt }),
  fr: () => import('@/translations/fr.json') as Promise<{ default: Dict }>,
  ar: () => import('@/translations/ar.json') as Promise<{ default: Dict }>,
  am: () => import('@/translations/am.json') as Promise<{ default: Dict }>,
  sw: () => import('@/translations/sw.json') as Promise<{ default: Dict }>,
  ln: () => import('@/translations/ln.json') as Promise<{ default: Dict }>,
  yo: () => import('@/translations/yo.json') as Promise<{ default: Dict }>,
  sn: () => import('@/translations/sn.json') as Promise<{ default: Dict }>,
  zu: () => import('@/translations/zu.json') as Promise<{ default: Dict }>,
  kmb: () => import('@/translations/kmb.json') as Promise<{ default: Dict }>,
  umb: () => import('@/translations/umb.json') as Promise<{ default: Dict }>,
  kg: () => import('@/translations/kg.json') as Promise<{ default: Dict }>,
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Durante HMR pode haver momentos sem contexto — devolver fallback evita crash.
    console.warn('useLanguage called outside LanguageProvider, using fallback');
    return { language: 'pt' as Language, setLanguage: () => {}, t: (key: string) => key };
  }
  return context;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('afroloc-language');
    return (stored as Language) || 'pt';
  });

  // Dicionários carregados em memória (arranca com pt + en, sempre presentes).
  const [dicts, setDicts] = useState<Partial<Record<Language, Dict>>>({ en, pt });
  const loadedRef = useRef<Set<Language>>(new Set(['en', 'pt']));

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('afroloc-language', lang);
    document.documentElement.lang = lang;
  }, []);

  // Carrega dinamicamente a língua ativa se ainda não estiver em memória.
  useEffect(() => {
    document.documentElement.lang = language;
    if (loadedRef.current.has(language)) return;
    let alive = true;
    loaders[language]()
      .then((mod) => {
        loadedRef.current.add(language);
        if (alive) setDicts((prev) => ({ ...prev, [language]: mod.default }));
      })
      .catch((err) => console.error('i18n: falha a carregar', language, err));
    return () => {
      alive = false;
    };
  }, [language]);

  const value = useMemo<LanguageContextType>(() => {
    const active = dicts[language];
    // Cascata: língua ativa → inglês → português → a própria chave.
    const t = (key: string): string => (active && active[key]) || en[key] || pt[key] || key;
    return { language, setLanguage, t };
  }, [language, dicts, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
