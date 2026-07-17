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

const translations: Record<Language, Record<string, string>> = {
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

export interface MissingTranslation {
  key: string;
  language: Language;
  referenceValue?: string;
}

export interface LanguageStats {
  code: Language;
  name: string;
  totalKeys: number;
  presentKeys: number;
  missingKeys: number;
  completionRate: number;
}

export interface ValidationReport {
  totalKeys: number;
  languages: Language[];
  missingTranslations: MissingTranslation[];
  completionRate: Record<Language, number>;
  languageStats: LanguageStats[];
  isValid: boolean;
  baselineLanguage: Language;
}

/**
 * Get all unique translation keys across all languages
 */
export const getAllTranslationKeys = (): Set<string> => {
  const allKeys = new Set<string>();
  
  Object.values(translations).forEach((languageTranslations) => {
    Object.keys(languageTranslations).forEach((key) => {
      allKeys.add(key);
    });
  });
  
  return allKeys;
};

/**
 * Find missing translations for a specific language
 */
export const findMissingTranslations = (
  language: Language,
  allKeys: Set<string>
): MissingTranslation[] => {
  const missing: MissingTranslation[] = [];
  const languageTranslations = translations[language];
  
  allKeys.forEach((key) => {
    if (!languageTranslations[key]) {
      // Try to get reference value from English
      const referenceValue = translations.en[key];
      missing.push({
        key,
        language,
        referenceValue,
      });
    }
  });
  
  return missing;
};

/**
 * Calculate completion rate for a language
 */
export const calculateCompletionRate = (
  language: Language,
  totalKeys: number
): number => {
  const languageTranslations = translations[language];
  const translatedKeys = Object.keys(languageTranslations).filter(
    (key) => languageTranslations[key] && languageTranslations[key].trim() !== ''
  ).length;
  
  return Math.round((translatedKeys / totalKeys) * 100);
};

const languageNames: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  pt: 'Português',
  ar: 'العربية (Arabic)',
  am: 'አማርኛ (Amharic)',
  sw: 'Kiswahili',
  ln: 'Lingála',
  yo: 'Yorùbá',
  sn: 'chiShona',
  zu: 'isiZulu',
  kmb: 'Kimbundu',
  umb: 'Umbundu',
  kg: 'Kikongo',
};

/**
 * Validate all translations and generate a comprehensive report
 */
export const validateTranslations = (): ValidationReport => {
  const allKeys = getAllTranslationKeys();
  const totalKeys = allKeys.size;
  const languages = Object.keys(translations) as Language[];
  const missingTranslations: MissingTranslation[] = [];
  const completionRate: Record<Language, number> = {} as Record<Language, number>;
  const languageStats: LanguageStats[] = [];
  
  // Find missing translations for each language
  languages.forEach((language) => {
    const missing = findMissingTranslations(language, allKeys);
    missingTranslations.push(...missing);
    const rate = calculateCompletionRate(language, totalKeys);
    completionRate[language] = rate;
    
    const presentKeys = Object.keys(translations[language]).filter(
      (key) => translations[language][key] && translations[language][key].trim() !== ''
    ).length;
    
    languageStats.push({
      code: language,
      name: languageNames[language],
      totalKeys,
      presentKeys,
      missingKeys: missing.length,
      completionRate: rate,
    });
  });
  
  // Sort by completion rate descending
  languageStats.sort((a, b) => b.completionRate - a.completionRate);
  
  return {
    totalKeys,
    languages,
    missingTranslations,
    completionRate,
    languageStats,
    isValid: missingTranslations.length === 0,
    baselineLanguage: 'pt',
  };
};

/**
 * Group missing translations by language
 */
export const groupMissingByLanguage = (
  missingTranslations: MissingTranslation[]
): Record<Language, MissingTranslation[]> => {
  const grouped = {} as Record<Language, MissingTranslation[]>;
  
  missingTranslations.forEach((missing) => {
    if (!grouped[missing.language]) {
      grouped[missing.language] = [];
    }
    grouped[missing.language].push(missing);
  });
  
  return grouped;
};

/**
 * Generate a formatted console report
 */
export const printValidationReport = (report: ValidationReport): void => {
  console.group('🌍 Translation Validation Report');
  
  console.log(`Total translation keys: ${report.totalKeys}`);
  console.log(`Languages: ${report.languages.join(', ')}`);
  console.log(`\nStatus: ${report.isValid ? '✅ All translations complete!' : '⚠️ Missing translations found'}`);
  
  if (!report.isValid) {
    console.log(`\nTotal missing translations: ${report.missingTranslations.length}`);
    
    const grouped = groupMissingByLanguage(report.missingTranslations);
    
    Object.entries(grouped).forEach(([language, missing]) => {
      const completion = report.completionRate[language as Language];
      console.group(`\n${language.toUpperCase()} - ${completion}% complete (${missing.length} missing)`);
      
      missing.slice(0, 10).forEach((m) => {
        console.log(`  • ${m.key}${m.referenceValue ? ` (en: "${m.referenceValue}")` : ''}`);
      });
      
      if (missing.length > 10) {
        console.log(`  ... and ${missing.length - 10} more`);
      }
      
      console.groupEnd();
    });
  }
  
  console.log('\nCompletion rates:');
  Object.entries(report.completionRate).forEach(([lang, rate]) => {
    const emoji = rate === 100 ? '✅' : rate >= 90 ? '🟡' : '🔴';
    console.log(`  ${emoji} ${lang.toUpperCase()}: ${rate}%`);
  });
  
  console.groupEnd();
};

/**
 * Get missing translations for current session (for development use)
 */
let usedKeys = new Set<string>();

export const trackTranslationUsage = (key: string): void => {
  if (import.meta.env.DEV) {
    usedKeys.add(key);
  }
};

export const getMissingKeysReport = (): Record<Language, string[]> => {
  const missing: Record<Language, string[]> = {} as Record<Language, string[]>;
  const languages = Object.keys(translations) as Language[];
  
  languages.forEach((language) => {
    missing[language] = [];
    usedKeys.forEach((key) => {
      if (!translations[language][key]) {
        missing[language].push(key);
      }
    });
  });
  
  return missing;
};

/**
 * Export report to JSON format
 */
export const exportReportToJSON = (report: ValidationReport): string => {
  return JSON.stringify(report, null, 2);
};

/**
 * Export all translations to Excel format for manual review
 */
export const exportTranslationsToExcel = async (): Promise<void> => {
  const { utils, writeFile } = await import('xlsx');
  const allKeys = getAllTranslationKeys();
  const languages = Object.keys(translations) as Language[];
  
  const languageNames: Record<Language, string> = {
    en: 'English',
    fr: 'Français',
    pt: 'Português',
    ar: 'العربية',
    am: 'አማርኛ',
    sw: 'Kiswahili',
    ln: 'Lingála',
    yo: 'Yorùbá',
    sn: 'chiShona',
    zu: 'isiZulu',
    kmb: 'Kimbundu',
    umb: 'Umbundu',
    kg: 'Kikongo',
  };
  
  // Create data array with headers
  const data: any[][] = [];
  
  // Header row
  const headers = ['Key', ...languages.map(lang => languageNames[lang])];
  data.push(headers);
  
  // Data rows
  Array.from(allKeys).sort().forEach(key => {
    const row = [key];
    languages.forEach(lang => {
      const value = translations[lang][key] || '';
      row.push(value);
    });
    data.push(row);
  });
  
  // Create workbook and worksheet
  const wb = utils.book_new();
  const ws = utils.aoa_to_sheet(data);
  
  // Set column widths
  const colWidths = [
    { wch: 30 }, // Key column
    ...languages.map(() => ({ wch: 40 })) // Language columns
  ];
  ws['!cols'] = colWidths;
  
  // Add worksheet to workbook
  utils.book_append_sheet(wb, ws, 'Translations');
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `AFROLOC-Translations-Manual-${timestamp}.xlsx`;
  
  // Download file
  writeFile(wb, filename);
};

export interface ImportedTranslations {
  [language: string]: Record<string, string>;
}

export interface ImportValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  translations: ImportedTranslations;
  stats: {
    totalKeys: number;
    updatedKeys: number;
    newKeys: number;
    languages: string[];
  };
}

/**
 * Import translations from Excel file
 */
export const importTranslationsFromExcel = async (file: File): Promise<ImportValidationResult> => {
  const { read, utils } = await import('xlsx');
  
  const result: ImportValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    translations: {},
    stats: {
      totalKeys: 0,
      updatedKeys: 0,
      newKeys: 0,
      languages: [],
    },
  };
  
  try {
    // Read file
    const data = await file.arrayBuffer();
    const wb = read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const jsonData = utils.sheet_to_json(ws, { header: 1 }) as any[][];
    
    if (jsonData.length < 2) {
      result.isValid = false;
      result.errors.push('Ficheiro Excel vazio ou inválido');
      return result;
    }
    
    // Parse header row
    const headers = jsonData[0] as string[];
    const keyIndex = 0;
    
    const languageMap: Record<string, Language> = {
      'English': 'en',
      'Français': 'fr',
      'Português': 'pt',
      'العربية': 'ar',
      'አማርኛ': 'am',
      'Kiswahili': 'sw',
      'Lingála': 'ln',
      'Yorùbá': 'yo',
      'chiShona': 'sn',
      'isiZulu': 'zu',
      'Kimbundu': 'kmb',
      'Umbundu': 'umb',
      'Kikongo': 'kg',
    };
    
    // Validate headers
    const languages = Object.keys(translations) as Language[];
    const foundLanguages: Language[] = [];
    const languageIndices: Record<Language, number> = {} as Record<Language, number>;
    
    headers.forEach((header, index) => {
      if (index === 0) return; // Skip key column
      const lang = languageMap[header];
      if (lang && languages.includes(lang)) {
        foundLanguages.push(lang);
        languageIndices[lang] = index;
      }
    });
    
    if (foundLanguages.length === 0) {
      result.isValid = false;
      result.errors.push('Nenhuma coluna de idioma válida encontrada');
      return result;
    }
    
    result.stats.languages = foundLanguages;
    
    // Initialize translation objects
    foundLanguages.forEach(lang => {
      result.translations[lang] = {};
    });
    
    // Parse data rows
    const currentKeys = getAllTranslationKeys();
    const processedKeys = new Set<string>();
    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const key = row[keyIndex];
      
      if (!key || typeof key !== 'string') {
        result.warnings.push(`Linha ${i + 1}: Chave inválida ou ausente`);
        continue;
      }
      
      processedKeys.add(key);
      
      // Check if it's a new key
      if (!currentKeys.has(key)) {
        result.stats.newKeys++;
      }
      
      // Process translations for each language
      foundLanguages.forEach(lang => {
        const value = row[languageIndices[lang]];
        const stringValue = value ? String(value).trim() : '';
        
        result.translations[lang][key] = stringValue;
        
        // Check if translation was updated
        if (translations[lang][key] !== stringValue) {
          result.stats.updatedKeys++;
        }
      });
    }
    
    result.stats.totalKeys = processedKeys.size;
    
    // Check for missing keys
    const missingKeys = Array.from(currentKeys).filter(k => !processedKeys.has(k));
    if (missingKeys.length > 0) {
      result.warnings.push(`${missingKeys.length} chaves existentes não encontradas no ficheiro importado`);
    }
    
  } catch (error) {
    result.isValid = false;
    result.errors.push(`Erro ao processar ficheiro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
  
  return result;
};

/**
 * Generate JSON files from imported translations
 */
export const generateTranslationFiles = (importedTranslations: ImportedTranslations): Record<Language, string> => {
  const files: Record<Language, string> = {} as Record<Language, string>;
  const languages = Object.keys(translations) as Language[];
  
  languages.forEach(lang => {
    if (importedTranslations[lang]) {
      files[lang] = JSON.stringify(importedTranslations[lang], null, 2);
    }
  });
  
  return files;
};
