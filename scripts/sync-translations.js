/**
 * Translation Sync Script
 * 
 * This script syncs all translation files to have the same keys as Portuguese (baseline).
 * Existing translations are preserved, missing keys get Portuguese values as placeholders.
 * 
 * Run with: node scripts/sync-translations.js
 */

const fs = require('fs');
const path = require('path');

const translationsDir = path.join(__dirname, '../src/translations');

// Read Portuguese as baseline
const ptPath = path.join(translationsDir, 'pt.json');
const ptContent = fs.readFileSync(ptPath, 'utf8');
const ptTranslations = JSON.parse(ptContent);

const languages = ['en', 'fr', 'ar', 'am', 'sw', 'yo', 'sn', 'zu', 'ln', 'umb', 'kmb', 'kg'];

console.log(`\n📚 AFROLOC Translation Sync\n`);
console.log(`Baseline: Portuguese (pt.json) with ${Object.keys(ptTranslations).length} keys\n`);

languages.forEach(lang => {
  const langPath = path.join(translationsDir, `${lang}.json`);
  
  let langTranslations = {};
  if (fs.existsSync(langPath)) {
    const langContent = fs.readFileSync(langPath, 'utf8');
    langTranslations = JSON.parse(langContent);
  }
  
  const existingKeys = Object.keys(langTranslations).length;
  let addedKeys = 0;
  
  // Merge: keep existing translations, add missing keys from Portuguese
  const mergedTranslations = { ...ptTranslations };
  
  // Overwrite with existing translations (preserving what we have)
  Object.keys(langTranslations).forEach(key => {
    if (langTranslations[key]) {
      mergedTranslations[key] = langTranslations[key];
    }
  });
  
  // Count added keys
  addedKeys = Object.keys(ptTranslations).length - existingKeys;
  
  // Write merged file
  fs.writeFileSync(
    langPath, 
    JSON.stringify(mergedTranslations, null, 2) + '\n',
    'utf8'
  );
  
  console.log(`✅ ${lang}.json: ${existingKeys} existing → ${Object.keys(mergedTranslations).length} total (+${Math.max(0, addedKeys)} keys)`);
});

console.log(`\n✨ Sync complete! All languages now have ${Object.keys(ptTranslations).length} keys.`);
console.log(`   Missing translations use Portuguese values as placeholders.\n`);
