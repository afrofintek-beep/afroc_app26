/**
 * Build-time Translation Validator
 * Ensures all translation files have complete coverage before build.
 * Exit code 1 = missing translations found (fails build)
 * Exit code 0 = all translations complete
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRANSLATIONS_DIR = path.join(__dirname, '../src/translations');
const MIN_COMPLETION_THRESHOLD = 100; // Require 100% completion

// Language display names
const LANGUAGE_NAMES = {
  en: 'English',
  pt: 'Português',
  fr: 'Français',
  ar: 'العربية',
  am: 'አማርኛ',
  sw: 'Kiswahili',
  ln: 'Lingála',
  yo: 'Yorùbá',
  sn: 'ChiShona',
  zu: 'isiZulu',
  kmb: 'Kimbundu',
  umb: 'Umbundu',
  kg: 'Kikongo'
};

function loadTranslations() {
  const translations = {};
  const files = fs.readdirSync(TRANSLATIONS_DIR).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const lang = file.replace('.json', '');
    const content = fs.readFileSync(path.join(TRANSLATIONS_DIR, file), 'utf-8');
    translations[lang] = JSON.parse(content);
  }
  
  return translations;
}

function getAllKeys(translations) {
  const allKeys = new Set();
  
  for (const lang of Object.keys(translations)) {
    for (const key of Object.keys(translations[lang])) {
      allKeys.add(key);
    }
  }
  
  return Array.from(allKeys).sort();
}

function findMissingKeys(translations, allKeys) {
  const missing = {};
  
  for (const [lang, data] of Object.entries(translations)) {
    const langKeys = Object.keys(data);
    const missingKeys = allKeys.filter(key => !langKeys.includes(key));
    
    if (missingKeys.length > 0) {
      missing[lang] = missingKeys;
    }
  }
  
  return missing;
}

function validateTranslations() {
  console.log('\n🌍 Translation Validation\n');
  console.log('='.repeat(50));
  
  const translations = loadTranslations();
  const allKeys = getAllKeys(translations);
  const missing = findMissingKeys(translations, allKeys);
  
  console.log(`\n📊 Total unique keys: ${allKeys.length}`);
  console.log(`📁 Languages: ${Object.keys(translations).length}\n`);
  
  let hasErrors = false;
  
  for (const [lang, data] of Object.entries(translations)) {
    const langName = LANGUAGE_NAMES[lang] || lang;
    const keyCount = Object.keys(data).length;
    const completion = Math.round((keyCount / allKeys.length) * 100);
    const missingCount = missing[lang]?.length || 0;
    
    const status = completion >= MIN_COMPLETION_THRESHOLD ? '✅' : '❌';
    console.log(`${status} ${langName} (${lang}): ${completion}% complete (${missingCount} missing)`);
    
    if (completion < MIN_COMPLETION_THRESHOLD) {
      hasErrors = true;
    }
  }
  
  if (hasErrors) {
    console.log('\n' + '='.repeat(50));
    console.log('\n❌ MISSING TRANSLATIONS:\n');
    
    for (const [lang, keys] of Object.entries(missing)) {
      const langName = LANGUAGE_NAMES[lang] || lang;
      console.log(`\n📌 ${langName} (${lang}) - ${keys.length} missing:`);
      keys.slice(0, 10).forEach(key => console.log(`   - ${key}`));
      if (keys.length > 10) {
        console.log(`   ... and ${keys.length - 10} more`);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('\n🚫 BUILD FAILED: Translation coverage incomplete.');
    console.log('   Run: npm run translations:sync to auto-fill missing keys.\n');
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('\n✅ All translations complete! Build can proceed.\n');
  process.exit(0);
}

validateTranslations();
