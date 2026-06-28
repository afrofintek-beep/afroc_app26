# Translation Validation Tool

## Overview

The Translation Validation Tool helps ensure that all translation keys are present across all supported languages in the AFROLOC application. This tool identifies missing translations, calculates completion rates, and provides detailed reports.

## Features

- ✅ Validates translations across all 13 supported languages
- 📊 Calculates completion rates for each language
- 🔍 Identifies missing translation keys
- 📄 Generates detailed reports in JSON format
- 🎯 Shows reference English translations for missing keys
- 🚀 Real-time validation during development

## Supported Languages

The tool validates translations for:
- English (en)
- French (fr)
- Portuguese (pt)
- Arabic (ar)
- Amharic (am)
- Swahili (sw)
- Lingala (ln)
- Yoruba (yo)
- Shona (sn)
- Zulu (zu)
- Kimbundu (kmb)
- Umbundu (umb)
- Kikongo (kg)

## How to Use

### 1. Admin Dashboard Access

Navigate to **Admin > Translation Validation** in the sidebar menu (requires admin privileges).

### 2. View Validation Report

The Translation Validation page displays:

#### Overview Tab
- Overall status (complete/incomplete)
- Total number of translation keys
- Completion rate for each language
- Visual progress bars

#### Missing Keys Tab
- Grouped by language
- Each missing key with its English reference
- Easy identification of what needs translation

### 3. Export Report

Click the **Export JSON** button to download a detailed report containing:
- Total keys count
- List of all languages
- Missing translations with references
- Completion rates

### 4. Development Mode

In development mode, the tool automatically:
- Validates translations on page load
- Logs warnings for missing keys in the console
- Shows a floating status button

## API Reference

### Core Functions

#### `validateTranslations()`
Runs a complete validation of all translations.

```typescript
import { validateTranslations } from '@/utils/translationValidator';

const report = validateTranslations();
console.log(report);
```

#### `getAllTranslationKeys()`
Returns all unique translation keys across all languages.

```typescript
import { getAllTranslationKeys } from '@/utils/translationValidator';

const keys = getAllTranslationKeys();
console.log(`Total keys: ${keys.size}`);
```

#### `findMissingTranslations(language, allKeys)`
Finds missing translations for a specific language.

```typescript
import { findMissingTranslations, getAllTranslationKeys } from '@/utils/translationValidator';

const allKeys = getAllTranslationKeys();
const missing = findMissingTranslations('pt', allKeys);
console.log(`Missing in Portuguese: ${missing.length}`);
```

#### `calculateCompletionRate(language, totalKeys)`
Calculates the completion percentage for a language.

```typescript
import { calculateCompletionRate, getAllTranslationKeys } from '@/utils/translationValidator';

const allKeys = getAllTranslationKeys();
const rate = calculateCompletionRate('pt', allKeys.size);
console.log(`Portuguese completion: ${rate}%`);
```

#### `printValidationReport(report)`
Prints a formatted report to the console.

```typescript
import { validateTranslations, printValidationReport } from '@/utils/translationValidator';

const report = validateTranslations();
printValidationReport(report);
```

## Report Structure

```typescript
interface ValidationReport {
  totalKeys: number;                    // Total number of unique keys
  languages: Language[];                // List of all languages
  missingTranslations: MissingTranslation[]; // Array of missing translations
  completionRate: Record<Language, number>;  // Completion percentage per language
  isValid: boolean;                     // true if all translations are complete
}

interface MissingTranslation {
  key: string;              // The translation key
  language: Language;       // The language missing this key
  referenceValue?: string;  // English reference (if available)
}
```

## Best Practices

### 1. Regular Validation
Run validation regularly during development to catch missing translations early.

### 2. Use English as Reference
Always maintain complete English translations as they serve as reference for other languages.

### 3. Export Reports
Export reports before major releases to track translation coverage.

### 4. Prioritize Languages
Focus on completing high-priority languages first:
- English (en) - Reference language
- Portuguese (pt) - Primary user base
- French (fr) - Secondary language
- Swahili (sw) - Regional importance

### 5. Track Coverage
Aim for at least 90% completion for production languages.

## Console Logging

In development mode, run the following in the browser console to see a detailed report:

```javascript
import { validateTranslations, printValidationReport } from '@/utils/translationValidator';

const report = validateTranslations();
printValidationReport(report);
```

## Adding New Languages

To add a new language:

1. Create a new JSON file in `src/translations/` (e.g., `es.json`)
2. Add the language to the `Language` type in `translationValidator.ts`
3. Import and add to the `translations` object
4. Update `LanguageContext.tsx` similarly

## Troubleshooting

### Missing keys not showing
- Clear browser cache
- Check that the translation files are properly imported
- Verify JSON syntax is valid

### Completion rate seems wrong
- Ensure all translation values are non-empty strings
- Check for whitespace-only values
- Verify key naming consistency

### Export not working
- Check browser console for errors
- Ensure pop-up blockers aren't interfering
- Try different browsers

## Contributing

When adding new features that require text:

1. Add the key to `en.json` first
2. Run validation to identify missing translations
3. Add translations for high-priority languages
4. Document the new keys

## Support

For issues or questions:
- Check the console for validation warnings
- Review the exported JSON report
- Contact the development team
