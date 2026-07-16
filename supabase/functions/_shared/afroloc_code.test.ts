/**
 * Testes do codec partilhado AFROLOC (_shared/afroloc_code.ts).
 * Correm sem Deno: `npx tsx supabase/functions/_shared/afroloc_code.test.ts`
 * (o módulo é TypeScript puro, sem APIs Deno).
 */
import {
  encodeAfroloc,
  decodeAfroloc,
  validateAfrolocCode,
  normalizeAfrolocCode,
  codeForms,
  toBase36,
  fromBase36,
} from './afroloc_code.ts';

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  }
}

console.log('— base36 N-prefix —');
check('toBase36(0) = "0"', toBase36(0) === '0');
check('roundtrip positivo', fromBase36(toBase36(146748)) === 146748);
check('roundtrip negativo', fromBase36(toBase36(-99849)) === -99849);
check('negativo tem prefixo N', toBase36(-99849).startsWith('N'));

console.log('— encode: exemplo Talatona (spec §11) —');
const enc = encodeAfroloc({ latitude: -8.93311, longitude: 13.18261, countryCode: 'AO', cellType: 'urban' });
check('ix = 146748', enc.tile_ix === 146748, enc.tile_ix);
check('iy = -99849', enc.tile_iy === -99849, enc.tile_iy);
console.log(`    standard: ${enc.afroloc}`);
console.log(`    centroid: ${enc.centroid.lat.toFixed(6)}, ${enc.centroid.lon.toFixed(6)}`);
check('formato standard sem prefixos X/Y', /^AO-ZU-G10-[0-9A-Z]+-N[0-9A-Z]+$/.test(enc.afroloc), enc.afroloc);

console.log('— encode com nomenclatura —');
const encNom = encodeAfroloc({
  latitude: -8.93311, longitude: 13.18261, countryCode: 'AO', cellType: 'urban',
  provinceCode: 'LUA', municipalityCode: 'TAL', communeCode: 'TAL', neighborhoodCode: 'GEN',
});
console.log(`    nomenclatura: ${encNom.afroloc}`);
check('mesma cauda G10-X-Y que o standard', encNom.afroloc.endsWith(enc.afroloc.split('-').slice(2).join('-')), encNom.afroloc);
check('afrolocLegacy = standard', encNom.afrolocLegacy === enc.afroloc);

console.log('— round-trip: decode(encode) devolve o centróide da célula —');
const dec = decodeAfroloc(enc.afroloc);
check('mesmo ix/iy', dec.tile_ix === enc.tile_ix && dec.tile_iy === enc.tile_iy);
check('centróide igual ao do encode', Math.abs(dec.centroid.lat - enc.centroid.lat) < 1e-12 && Math.abs(dec.centroid.lon - enc.centroid.lon) < 1e-12);

console.log('— tolerância a prefixos X/Y (codec offline do cliente) —');
const parts = enc.afroloc.split('-');
const prefixed = [...parts.slice(0, -2), 'X' + parts[parts.length - 2], 'Y' + parts[parts.length - 1]].join('-');
console.log(`    forma prefixada: ${prefixed}`);
const nPref = normalizeAfrolocCode(prefixed);
check('prefixada é válida', nPref.valid, nPref.error);
check('normaliza para a forma canónica (sem X/Y)', nPref.normalized === enc.afroloc, nPref.normalized);
const decPref = decodeAfroloc(prefixed);
check('decode da prefixada = decode da canónica (fix do bug X=33)', decPref.tile_ix === dec.tile_ix && decPref.tile_iy === dec.tile_iy);

console.log('— casos que o gateway antigo REJEITAVA e agora aceita —');
// 6 partes (PROV-MUN sem COM): o qg-engine sempre gerou isto; o regex antigo do gateway rejeitava.
const sixPart = encodeAfroloc({
  latitude: -8.858, longitude: 13.231, countryCode: 'AO', cellType: 'urban',
  provinceCode: 'LUA', municipalityCode: 'LUA',
}).afroloc;
console.log(`    6 partes: ${sixPart}`);
check('6 partes válido', normalizeAfrolocCode(sixPart).valid, normalizeAfrolocCode(sixPart).error);
// código real de produção do Yamioo (~243k neste formato)
const prod = 'AO-LUA-LUA-ING-G10-35MZ-N240O';
const nProd = normalizeAfrolocCode(prod);
check('código de produção Yamioo válido', nProd.valid && nProd.normalized === prod, nProd);
const dProd = decodeAfroloc(prod);
check('produção decodifica dentro de Angola', dProd.centroid.lat > -19 && dProd.centroid.lat < -4 && dProd.centroid.lon > 11 && dProd.centroid.lon < 25, dProd.centroid);

console.log('— conversões legadas preservadas —');
const urbanWord = normalizeAfrolocCode(`AO-URBAN-G10-X${parts[3]}-Y${parts[4]}`);
check('URBAN → ZU (com prefixos)', urbanWord.valid && urbanWord.normalized === enc.afroloc, urbanWord);
const qgPrefix = validateAfrolocCode(`AO-QG-G10-${parts[3]}-${parts[4]}`);
check('QG → ZU', qgPrefix.valid && qgPrefix.normalizedCode === enc.afroloc, qgPrefix);

console.log('— codeForms —');
const forms = codeForms(enc.afroloc);
check('devolve canónica + prefixada', forms.length === 2 && forms[0] === enc.afroloc && forms[1] === prefixed, forms);

console.log('— rejeições —');
check('país de 3 letras rejeitado', !normalizeAfrolocCode('AOX-ZU-G10-35O8-N247T').valid);
check('grelha inválida rejeitada', !normalizeAfrolocCode('AO-ZU-G15-35O8-N247T').valid);
check('vazio rejeitado', !normalizeAfrolocCode('').valid);

console.log('— rural G25 —');
const rural = encodeAfroloc({ latitude: -14.5, longitude: 17.0, countryCode: 'AO' });
check('zona rural fora dos centros urbanos', rural.zone === 'rural' && rural.grid_m === 25, rural.zone);
check('legacy tag ZR', rural.afroloc.includes('-ZR-G25-'), rural.afroloc);

if (failures > 0) {
  console.error(`\n${failures} teste(s) FALHARAM`);
  process.exit(1);
} else {
  console.log('\nTodos os testes passaram ✓');
}
