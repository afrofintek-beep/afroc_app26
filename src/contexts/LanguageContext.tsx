import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import enTranslations from '@/translations/en.json';
import frTranslations from '@/translations/fr.json';
import ptTranslations from '@/translations/pt.json';
import arTranslations from '@/translations/ar.json';
import amTranslations from '@/translations/am.json';
import swTranslations from '@/translations/sw.json';
import lnTranslations from '@/translations/ln.json';
import yoTranslations from '@/translations/yo.json';
import snTranslations from '@/translations/sn.json';
import zuTranslations from '@/translations/zu.json';
import kmbTranslations from '@/translations/kmb.json';
import umbTranslations from '@/translations/umb.json';
import kgTranslations from '@/translations/kg.json';

export type Language = 'en' | 'fr' | 'pt' | 'ar' | 'am' | 'sw' | 'ln' | 'yo' | 'sn' | 'zu' | 'kmb' | 'umb' | 'kg';

// Raw translations from JSON files
const rawTranslations: Record<Language, Record<string, string>> = {
  en: enTranslations,
  fr: frTranslations,
  pt: ptTranslations,
  ar: arTranslations,
  am: amTranslations,
  sw: swTranslations,
  ln: lnTranslations,
  yo: yoTranslations,
  sn: snTranslations,
  zu: zuTranslations,
  kmb: kmbTranslations,
  umb: umbTranslations,
  kg: kgTranslations,
};

// Get all keys from ALL language files to ensure complete coverage
const getAllKeys = (): Set<string> => {
  const keySet = new Set<string>();
  Object.values(rawTranslations).forEach(langData => {
    Object.keys(langData).forEach(key => keySet.add(key));
  });
  return keySet;
};
const allKeys = getAllKeys();

// Build merged translations with fallback to English, then Portuguese
const getMergedTranslations = (lang: Language): Record<string, string> => {
  const langData = rawTranslations[lang] || {};
  const merged: Record<string, string> = {};
  
  allKeys.forEach(key => {
    // Use language translation if exists, otherwise fall back to English, then Portuguese
    merged[key] = langData[key] || rawTranslations.en[key] || rawTranslations.pt[key] || key;
  });
  
  return merged;
};

// Pre-build merged translations for all languages
const translations: Record<Language, Record<string, string>> = {
  en: getMergedTranslations('en'),
  fr: getMergedTranslations('fr'),
  pt: getMergedTranslations('pt'),
  ar: getMergedTranslations('ar'),
  am: getMergedTranslations('am'),
  sw: getMergedTranslations('sw'),
  ln: getMergedTranslations('ln'),
  yo: getMergedTranslations('yo'),
  sn: getMergedTranslations('sn'),
  zu: getMergedTranslations('zu'),
  kmb: getMergedTranslations('kmb'),
  umb: getMergedTranslations('umb'),
  kg: getMergedTranslations('kg'),
};

// Fallback is now handled in getMergedTranslations

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Durante HMR (Hot Module Replacement), pode haver momentos onde o contexto não está disponível
    // Retornamos valores padrão para evitar crash durante desenvolvimento
    console.warn('useLanguage called outside LanguageProvider, using fallback');
    return {
      language: 'pt' as Language,
      setLanguage: () => {},
      t: (key: string) => key
    };
  }
  return context;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('afroloc-language');
    return (stored as Language) || 'pt';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('afroloc-language', lang);
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string): string => {
    // First check pre-merged translations, then fall back to raw translations for any keys added after initial build
    const premerged = translations[language][key];
    if (premerged && premerged !== key) {
      return premerged;
    }
    
    // Direct lookup in raw translations with cascading fallback
    const langData = rawTranslations[language];
    if (langData && langData[key]) {
      return langData[key];
    }
    
    // Fallback to English
    if (rawTranslations.en[key]) {
      return rawTranslations.en[key];
    }
    
    // Fallback to Portuguese
    if (rawTranslations.pt[key]) {
      return rawTranslations.pt[key];
    }
    
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
