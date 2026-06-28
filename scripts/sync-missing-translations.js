/**
 * Sync Missing Translations
 * Copies missing keys from English to all other languages as placeholders.
 * This ensures build passes while translations are pending.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRANSLATIONS_DIR = path.join(__dirname, '../src/translations');
const BASE_LANGUAGE = 'pt'; // Use Portuguese as the base/fallback language

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

function saveTranslation(lang, data) {
  const filePath = path.join(TRANSLATIONS_DIR, `${lang}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function syncTranslations() {
  console.log('\n🔄 Syncing Missing Translations\n');
  console.log('='.repeat(50));
  
  const translations = loadTranslations();
  const baseTranslation = translations[BASE_LANGUAGE];
  
  if (!baseTranslation) {
    console.error(`❌ Base language (${BASE_LANGUAGE}) not found!`);
    process.exit(1);
  }
  
  const baseKeys = Object.keys(baseTranslation);
  console.log(`\n📊 Base language (${BASE_LANGUAGE}): ${baseKeys.length} keys\n`);
  
  let totalAdded = 0;
  
  for (const [lang, data] of Object.entries(translations)) {
    if (lang === BASE_LANGUAGE) continue;
    
    const langKeys = Object.keys(data);
    const missingKeys = baseKeys.filter(key => !langKeys.includes(key));
    
    if (missingKeys.length === 0) {
      console.log(`✅ ${lang}: Complete`);
      continue;
    }
    
    // Add missing keys with English value as placeholder
    for (const key of missingKeys) {
      data[key] = baseTranslation[key];
    }
    
    // Sort keys alphabetically
    const sortedData = {};
    Object.keys(data).sort().forEach(key => {
      sortedData[key] = data[key];
    });
    
    saveTranslation(lang, sortedData);
    console.log(`📝 ${lang}: Added ${missingKeys.length} missing keys`);
    totalAdded += missingKeys.length;
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (totalAdded > 0) {
    console.log(`\n✅ Synced ${totalAdded} missing translations.`);
    console.log('   Note: English placeholders added. Review and translate them.\n');
  } else {
    console.log('\n✅ All translations already in sync!\n');
  }
}

syncTranslations();
