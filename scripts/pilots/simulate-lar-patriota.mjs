import { readFile } from 'node:fs/promises';
import { evaluate } from './lar-patriota-policy.mjs';

// Offline only: never connects to Supabase, sends SMS or writes profile states.
try {
  if (process.argv.length !== 3) throw new Error('usage');
  const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const now = input.now ? Date.parse(input.now) : Date.now();
  process.stdout.write(JSON.stringify(evaluate(input.request, input.context, now), null, 2) + '\n');
} catch {
  process.stderr.write('Use: node scripts/pilots/simulate-lar-patriota.mjs input.json (JSON válido).\n');
  process.exitCode = 1;
}
