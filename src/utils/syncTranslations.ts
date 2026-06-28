/**
 * Translation Sync Utility
 * 
 * This utility helps sync all translation files with the Portuguese baseline.
 * Missing keys from Portuguese will be copied to other languages.
 */

import ptTranslations from '@/translations/pt.json';
import enTranslations from '@/translations/en.json';
import frTranslations from '@/translations/fr.json';
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

type Language = 'en' | 'fr' | 'pt' | 'ar' | 'am' | 'sw' | 'yo' | 'sn' | 'zu' | 'ln' | 'umb' | 'kmb' | 'kg';

interface TranslationFile {
  [key: string]: string;
}

const translations: Record<Language, TranslationFile> = {
  pt: ptTranslations as TranslationFile,
  en: enTranslations as TranslationFile,
  fr: frTranslations as TranslationFile,
  ar: arTranslations as TranslationFile,
  am: amTranslations as TranslationFile,
  sw: swTranslations as TranslationFile,
  ln: lnTranslations as TranslationFile,
  yo: yoTranslations as TranslationFile,
  sn: snTranslations as TranslationFile,
  zu: zuTranslations as TranslationFile,
  kmb: kmbTranslations as TranslationFile,
  umb: umbTranslations as TranslationFile,
  kg: kgTranslations as TranslationFile,
};

/**
 * Get merged translations for a language (fills missing keys with Portuguese)
 */
export function getMergedTranslations(lang: Language): TranslationFile {
  const ptKeys = Object.keys(translations.pt);
  const langTranslations = translations[lang] || {};
  
  const merged: TranslationFile = {};
  
  ptKeys.forEach(key => {
    // Use existing translation if available, otherwise use Portuguese
    merged[key] = langTranslations[key] || translations.pt[key];
  });
  
  return merged;
}

/**
 * Generate a JSON file for a specific language with all keys synced
 */
export function generateSyncedTranslationFile(lang: Language): string {
  const merged = getMergedTranslations(lang);
  return JSON.stringify(merged, null, 2);
}

/**
 * Download all synced translation files as a ZIP or individual files
 */
export async function downloadSyncedTranslations(): Promise<void> {
  const languages: Language[] = ['en', 'fr', 'ar', 'am', 'sw', 'yo', 'sn', 'zu', 'ln', 'umb', 'kmb', 'kg'];
  
  for (const lang of languages) {
    const content = generateSyncedTranslationFile(lang);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lang}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Small delay between downloads
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

/**
 * Get sync statistics for all languages
 */
export function getSyncStats(): Array<{
  language: Language;
  existingKeys: number;
  totalKeys: number;
  missingKeys: number;
  completionRate: number;
}> {
  const ptKeys = Object.keys(translations.pt);
  const totalKeys = ptKeys.length;
  
  return Object.keys(translations)
    .filter(lang => lang !== 'pt')
    .map(lang => {
      const langTranslations = translations[lang as Language];
      const existingKeys = Object.keys(langTranslations).filter(
        key => ptKeys.includes(key) && langTranslations[key]
      ).length;
      
      return {
        language: lang as Language,
        existingKeys,
        totalKeys,
        missingKeys: totalKeys - existingKeys,
        completionRate: Math.round((existingKeys / totalKeys) * 100)
      };
    });
}

export { translations };
