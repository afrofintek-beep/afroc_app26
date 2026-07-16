/**
 * AFROLOC — Codec canónico partilhado (QG)
 *
 * Copyright (c) 2024-2026 AFROFINTEK GmbH. All rights reserved.
 *
 * ÚNICA implementação do codec de código AFROLOC no servidor.
 * Importada por `qg-engine` (encode/decode/validate) e por `yamioo-gateway`
 * (normalização + lookup_batch). Antes desta extração existiam três
 * validadores divergentes (spec, qg-engine, gateway) — ver
 * docs/SPEC_CODEC_AFROLOC.md §4/§6 e docs/current-system-assessment.md
 * (repo YAMIOO 2) para o histórico.
 *
 * REGRAS CANÓNICAS (v2.0.0 da spec):
 * - Coordenada de célula: base36 MAIÚSCULO com prefixo `N` para negativos
 *   (NÃO zig-zag — o zig-zag da spec v1 nunca chegou à BD canónica).
 * - Forma canónica do código: SEM prefixos `X`/`Y` nos dois últimos
 *   segmentos (ex.: `AO-ZU-G10-35O8-N247T`). Formas com prefixo
 *   (`...-X35O8-YN247T`, geradas pelo codec offline do cliente) são
 *   ACEITES na entrada e normalizadas por remoção do prefixo.
 * - Ambiguidade residual: um código zig-zag histórico com prefixos
 *   (demo antigo do Yamioo) é indistinguível de um N-prefix prefixado e
 *   descodificaria para outra célula. Esses códigos nunca entraram na BD
 *   canónica; não são suportados.
 */

// --- Constantes ---
export const R = 6378137.0; // raio WGS84 usado pelo Web Mercator
export const MAX_LAT = 85.05112878;
export const URBAN_CELL_SIZE = 10;
export const RURAL_CELL_SIZE = 25;

// --- Tipos ---
export interface QGRequest {
  latitude: number;
  longitude: number;
  countryCode: string;
  cellType?: 'urban' | 'rural' | 'auto';
  adminPath?: string; // para resolução de zona por keywords
  provinceCode?: string;
  municipalityCode?: string;
  communeCode?: string;
  neighborhoodCode?: string;
  registrationType?: 'formal' | 'digital';
}

export interface QGResponse {
  afroloc: string;
  afrolocLegacy?: string;
  country: string;
  zone: 'urban' | 'rural';
  grid_m: number;
  tile_ix: number;
  tile_iy: number;
  provinceCode?: string;
  municipalityCode?: string;
  communeCode?: string;
  neighborhoodCode?: string;
  bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number };
  centroid: { lon: number; lat: number };
  webMercator: { x: number; y: number };
}

export type DecodeResponse = Omit<QGResponse, 'webMercator'>;

// --- Utilidades ---
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function deg(r: number): number {
  return (r * 180) / Math.PI;
}

// Base36 com suporte a negativos (prefixo "N")
export function toBase36(n: number): string {
  if (n === 0) return "0";
  const x = Math.abs(Math.trunc(n));
  const prefix = n < 0 ? "N" : "";
  return prefix + x.toString(36).toUpperCase();
}

export function fromBase36(s: string): number {
  const str = String(s).toUpperCase();
  if (str.startsWith("N")) return -parseInt(str.slice(1), 36);
  if (str.startsWith("-")) return -parseInt(str.slice(1), 36);
  return parseInt(str, 36);
}

// --- WebMercator (EPSG:3857) ---
export function lonLatToMercator(lon: number, lat: number): { x: number; y: number } {
  const clat = clamp(lat, -MAX_LAT, MAX_LAT);
  const x = R * rad(lon);
  const y = R * Math.log(Math.tan(Math.PI / 4 + rad(clat) / 2));
  return { x, y };
}

export function mercatorToLonLat(x: number, y: number): { lon: number; lat: number } {
  const lon = deg(x / R);
  const lat = deg(2 * Math.atan(Math.exp(y / R)) - Math.PI / 2);
  return { lon, lat };
}

// --- Deteção de zona ---
const URBAN_KEYWORDS: Record<string, string[]> = {
  'AO': ['LUANDA', 'TALATONA', 'VIANA', 'CAZENGA', 'BELAS', 'KILAMBA', 'BENGUELA', 'LOBITO', 'HUAMBO', 'CABINDA', 'LUBANGO', 'MALANJE', 'NAMIBE'],
  'ZA': ['JOHANNESBURG', 'CAPE TOWN', 'DURBAN', 'PRETORIA', 'PORT ELIZABETH', 'BLOEMFONTEIN', 'EAST LONDON', 'SOWETO'],
  'KE': ['NAIROBI', 'MOMBASA', 'KISUMU', 'NAKURU', 'ELDORET'],
  'NG': ['LAGOS', 'ABUJA', 'KANO', 'IBADAN', 'PORT HARCOURT', 'BENIN CITY'],
  'MZ': ['MAPUTO', 'MATOLA', 'BEIRA', 'NAMPULA'],
  'ZW': ['HARARE', 'BULAWAYO', 'CHITUNGWIZA'],
  'GH': ['ACCRA', 'KUMASI', 'TAMALE'],
  'TZ': ['DAR ES SALAAM', 'DODOMA', 'MWANZA', 'ARUSHA'],
  'UG': ['KAMPALA', 'ENTEBBE'],
  'ET': ['ADDIS ABABA', 'DIRE DAWA'],
  'SN': ['DAKAR', 'THIES'],
  'CI': ['ABIDJAN', 'BOUAKE', 'YAMOUSSOUKRO'],
};

const URBAN_CENTERS: Record<string, Array<{ lat: number; lon: number; radius: number }>> = {
  'AO': [
    { lat: -8.839, lon: 13.289, radius: 0.25 },   // Luanda
    { lat: -12.575, lon: 13.405, radius: 0.08 },  // Benguela
    { lat: -12.345, lon: 16.876, radius: 0.08 },  // Lubango
    { lat: -12.769, lon: 15.735, radius: 0.1 },   // Huambo
    { lat: -5.557, lon: 12.189, radius: 0.08 },   // Cabinda
  ],
  'ZA': [
    { lat: -26.204, lon: 28.045, radius: 0.35 },  // Johannesburg
    { lat: -33.925, lon: 18.424, radius: 0.25 },  // Cape Town
    { lat: -29.858, lon: 31.029, radius: 0.2 },   // Durban
  ],
  'KE': [
    { lat: -1.286, lon: 36.817, radius: 0.25 },   // Nairobi
    { lat: -4.043, lon: 39.668, radius: 0.12 },   // Mombasa
  ],
  'NG': [
    { lat: 6.524, lon: 3.379, radius: 0.35 },     // Lagos
    { lat: 9.057, lon: 7.495, radius: 0.2 },      // Abuja
  ],
  'MZ': [
    { lat: -25.966, lon: 32.585, radius: 0.12 },  // Maputo
  ],
};

function resolveZoneByKeywords(countryCode: string, adminPath: string): 'urban' | 'rural' | null {
  const keywords = URBAN_KEYWORDS[countryCode] || [];
  const pathUpper = adminPath.toUpperCase();
  for (const keyword of keywords) {
    if (pathUpper.includes(keyword)) return 'urban';
  }
  return null;
}

function resolveZoneByCoordinates(lat: number, lon: number, countryCode: string): 'urban' | 'rural' {
  const centers = URBAN_CENTERS[countryCode] || [];
  for (const center of centers) {
    const distance = Math.sqrt(Math.pow(lat - center.lat, 2) + Math.pow(lon - center.lon, 2));
    if (distance <= center.radius) return 'urban';
  }
  return 'rural';
}

export function resolveZone(lat: number, lon: number, countryCode: string, adminPath?: string): 'urban' | 'rural' {
  if (adminPath) {
    const keywordResult = resolveZoneByKeywords(countryCode, adminPath);
    if (keywordResult) return keywordResult;
  }
  return resolveZoneByCoordinates(lat, lon, countryCode);
}

// --- Encode ---
export function encodeAfroloc(request: QGRequest): QGResponse {
  const {
    latitude,
    longitude,
    countryCode,
    cellType,
    adminPath,
    provinceCode,
    municipalityCode,
    communeCode,
    neighborhoodCode,
    registrationType = 'formal',
  } = request;

  let zone: 'urban' | 'rural';
  if (cellType && cellType !== 'auto') {
    zone = cellType;
  } else {
    zone = resolveZone(latitude, longitude, countryCode, adminPath);
  }

  const gridSize = zone === 'urban' ? URBAN_CELL_SIZE : RURAL_CELL_SIZE;
  const { x, y } = lonLatToMercator(longitude, latitude);

  const ix = Math.floor(x / gridSize);
  const iy = Math.floor(y / gridSize);

  const cc = countryCode.toUpperCase();
  const xCode = toBase36(ix);
  const yCode = toBase36(iy);
  const gridTag = `G${gridSize}`;

  let code: string;

  const normProv = provinceCode?.toUpperCase().slice(0, 3) || '';
  const normMun = municipalityCode?.toUpperCase().slice(0, 3) || '';
  const normCom = communeCode?.toUpperCase().slice(0, 3) || '';
  const normBai = registrationType === 'digital' ? 'DIG' : (neighborhoodCode?.toUpperCase().slice(0, 3) || '');

  // Formato oficial: CC-PROV-MUN-COM-BAI-G10-X-Y
  if (normProv && normMun && normCom && normBai) {
    code = `${cc}-${normProv}-${normMun}-${normCom}-${normBai}-${gridTag}-${xCode}-${yCode}`;
  } else if (normProv && normMun && normCom) {
    if (registrationType === 'digital') {
      code = `${cc}-${normProv}-${normMun}-${normCom}-DIG-${gridTag}-${xCode}-${yCode}`;
    } else {
      code = `${cc}-${normProv}-${normMun}-${normCom}-${gridTag}-${xCode}-${yCode}`;
    }
  } else if (normProv && normMun) {
    if (registrationType === 'digital') {
      code = `${cc}-${normProv}-${normMun}-DIG-${gridTag}-${xCode}-${yCode}`;
    } else {
      code = `${cc}-${normProv}-${normMun}-${gridTag}-${xCode}-${yCode}`;
    }
  } else if (normMun) {
    if (registrationType === 'digital') {
      code = `${cc}-${normMun}-DIG-${gridTag}-${xCode}-${yCode}`;
    } else {
      code = `${cc}-${normMun}-${gridTag}-${xCode}-${yCode}`;
    }
  } else {
    if (registrationType === 'digital') {
      code = `${cc}-DIG-${gridTag}-${xCode}-${yCode}`;
    } else {
      const zoneTag = zone === 'urban' ? 'ZU' : 'ZR';
      code = `${cc}-${zoneTag}-${gridTag}-${xCode}-${yCode}`;
    }
  }

  const zoneTag = zone === 'urban' ? 'ZU' : 'ZR';
  const legacyCode = `${cc}-${zoneTag}-${gridTag}-${xCode}-${yCode}`;

  const minx = ix * gridSize;
  const miny = iy * gridSize;
  const maxx = (ix + 1) * gridSize;
  const maxy = (iy + 1) * gridSize;

  const sw = mercatorToLonLat(minx, miny);
  const ne = mercatorToLonLat(maxx, maxy);

  const cx = (minx + maxx) / 2;
  const cy = (miny + maxy) / 2;
  const c = mercatorToLonLat(cx, cy);

  return {
    afroloc: code,
    afrolocLegacy: legacyCode,
    country: cc,
    zone,
    grid_m: gridSize,
    tile_ix: ix,
    tile_iy: iy,
    provinceCode: normProv || undefined,
    municipalityCode: normMun || undefined,
    communeCode: normCom || undefined,
    neighborhoodCode: normBai || undefined,
    bbox: { minLon: sw.lon, minLat: sw.lat, maxLon: ne.lon, maxLat: ne.lat },
    centroid: { lon: c.lon, lat: c.lat },
    webMercator: { x, y },
  };
}

// --- Deteção e conversão de formatos legados ---
export interface LegacyConversionResult {
  converted: boolean;
  newCode: string;
  originalFormat?: string;
  extractedAdmin?: {
    municipalityCode?: string;
    communeCode?: string;
    neighborhoodCode?: string;
  };
}

/**
 * Formatos suportados:
 * 1. OFICIAL:  CC-MUN-COM-BAI-G10-X-Y (7 partes)
 * 2. PARCIAL:  CC-MUN-COM-G10-X-Y (6 partes)
 * 3. MÍNIMO:   CC-MUN-G10-X-Y (5 partes)
 * 4. LEGACY:   CC-ZU-G10-X-Y (5 partes, por zona)
 *
 * Sub-formatos legados (convertidos automaticamente):
 * - Prefixos X/Y nos dois últimos segmentos: CC-ZU-G10-X35O8-YN247T
 * - Negativo com hífen antigo: CC-ZU-G10-X-123-Y-456
 * - XY combinado antigo: CC-ZU-G10-X123Y456
 * - Sem prefixo G: CC-ZU-10-123-456
 * - Prefixo QG antigo: CC-QG-G10-123-456
 */
export function detectAndConvertLegacy(code: string): LegacyConversionResult {
  let c = code.trim().toUpperCase();

  // Corrigir erros comuns de OCR/typo no código do país (0 -> O, 1 -> I)
  if (c.length >= 2) {
    const firstTwo = c.substring(0, 2)
      .replace(/0/g, 'O')
      .replace(/1/g, 'I');
    c = firstTwo + c.substring(2);
  }

  // Formato 0: formato antigo com pontos e coordenadas embebidas
  // ex.: AO.LUA.TAL.XXX.YYY.GE-57.H@-8.9330,13.1825
  if (c.includes('.') && c.includes('@')) {
    const atIndex = c.indexOf('@');
    const coordPart = c.substring(atIndex + 1);
    const codePart = c.substring(0, atIndex);

    const coordMatch = coordPart.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);

      const segments = codePart.split('.');
      const countryCode = segments[0];
      const municipalityCode = segments[1] || undefined;
      const communeCode = segments[2] || undefined;
      const neighborhoodCode = segments[3] || undefined;

      if (/^[A-Z]{2}$/.test(countryCode) && !isNaN(lat) && !isNaN(lon)) {
        const encoded = encodeAfroloc({
          latitude: lat,
          longitude: lon,
          countryCode,
          cellType: 'auto',
          municipalityCode,
          communeCode,
          neighborhoodCode,
        });
        return {
          converted: true,
          newCode: encoded.afroloc,
          originalFormat: 'dot-coordinate-legacy',
          extractedAdmin: { municipalityCode, communeCode, neighborhoodCode },
        };
      }
    }
  }

  // Formato 0b: pontos sem coordenadas
  if (c.includes('.') && !c.includes('-')) {
    return { converted: false, newCode: c };
  }

  let parts = c.split('-');
  let converted = false;
  let originalFormat: string | undefined;

  // Formato 0c: tags de zona por extenso (URBAN/RURAL → ZU/ZR),
  // aceites pelo gateway histórico.
  if (parts.length >= 2 && (parts[1] === 'URBAN' || parts[1] === 'RURAL')) {
    parts[1] = parts[1] === 'URBAN' ? 'ZU' : 'ZR';
    c = parts.join('-');
    converted = true;
    originalFormat = 'zone-word';
  }

  // Formato 1: negativos com hífen antigos (mais de 7 partes)
  if (parts.length > 7) {
    const merged: string[] = [];
    let i = 0;
    while (i < parts.length) {
      if (parts[i] === '' && i + 1 < parts.length) {
        merged.push('N' + parts[i + 1]);
        i += 2;
      } else {
        merged.push(parts[i]);
        i++;
      }
    }
    parts = merged;
    c = parts.join('-');
  }

  // Formato 2: XY combinado antigo (X123Y456 numa só parte)
  for (let i = 0; i < parts.length; i++) {
    const xyMatch = parts[i].match(/^X(-?\d+|N?\d+|[A-Z0-9]+)Y(-?\d+|N?\d+|[A-Z0-9]+)$/i);
    if (xyMatch) {
      let xVal = xyMatch[1];
      let yVal = xyMatch[2];
      if (xVal.startsWith('-')) xVal = 'N' + xVal.slice(1);
      if (yVal.startsWith('-')) yVal = 'N' + yVal.slice(1);
      parts.splice(i, 1, xVal, yVal);
      c = parts.join('-');
      break;
    }
  }

  // Formato 2b (NOVO, v2.0.0): prefixos X/Y nos dois últimos segmentos.
  // Gerados pelo codec offline do cliente e por integrações antigas
  // (ex.: X35O8-YN247T). A forma canónica é SEM prefixo; remove-se o X/Y
  // quando AMBOS os últimos segmentos os têm e o resto é base36/N válido.
  // Nota: sem remoção, o decode leria "X"/"Y" como dígitos base36 (X=33)
  // e devolveria uma célula errada — bug latente corrigido aqui.
  if (parts.length >= 5) {
    const xpart = parts[parts.length - 2];
    const ypart = parts[parts.length - 1];
    const xm = xpart.match(/^X(N?[0-9A-Z]+)$/);
    const ym = ypart.match(/^Y(N?[0-9A-Z]+)$/);
    if (xm && ym) {
      parts[parts.length - 2] = xm[1];
      parts[parts.length - 1] = ym[1];
      c = parts.join('-');
      converted = true;
      originalFormat = originalFormat ?? 'xy-prefixed';
    }
  }

  // Formato 3: falta o prefixo G na grelha
  for (let i = 0; i < parts.length; i++) {
    if (/^\d+$/.test(parts[i]) && (parts[i] === '10' || parts[i] === '25')) {
      parts[i] = 'G' + parts[i];
      c = parts.join('-');
      break;
    }
  }

  // Formato 4: prefixo QG antigo em vez de ZU/ZR
  if (parts.length >= 2 && parts[1] === 'QG') {
    parts[1] = 'ZU';
    c = parts.join('-');
    return { converted: true, newCode: c, originalFormat: 'qg-prefix' };
  }

  // Formato 5: códigos com sufixo SQ (remover)
  if (parts.some(p => p.startsWith('SQ'))) {
    const sqIndex = parts.findIndex(p => p.startsWith('SQ'));
    parts = parts.slice(0, sqIndex);
    c = parts.join('-');
    return { converted: true, newCode: c, originalFormat: 'sq-suffix' };
  }

  // Formato oficial/parcial/mínimo: extrair códigos administrativos
  if (parts.length === 7) {
    const [country, mun, com, bai, grid] = parts;
    if (/^[A-Z]{2}$/.test(country) && /^G\d+$/.test(grid)) {
      return {
        converted,
        newCode: c,
        originalFormat,
        extractedAdmin: { municipalityCode: mun, communeCode: com, neighborhoodCode: bai },
      };
    }
  } else if (parts.length === 6) {
    const [country, mun, com, grid] = parts;
    if (/^[A-Z]{2}$/.test(country) && /^G\d+$/.test(grid)) {
      return {
        converted,
        newCode: c,
        originalFormat,
        extractedAdmin: { municipalityCode: mun, communeCode: com },
      };
    }
  } else if (parts.length === 5) {
    const [country, second, grid] = parts;
    if (/^[A-Z]{2}$/.test(country) && /^G\d+$/.test(grid)) {
      if (second !== 'ZU' && second !== 'ZR') {
        return {
          converted,
          newCode: c,
          originalFormat,
          extractedAdmin: { municipalityCode: second },
        };
      }
    }
  }

  return { converted, newCode: c, originalFormat };
}

// --- Validate ---
export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalizedCode?: string;
  wasConverted?: boolean;
  originalFormat?: string;
  format?: 'official' | 'partial' | 'minimal' | 'legacy';
  extractedAdmin?: {
    municipalityCode?: string;
    communeCode?: string;
    neighborhoodCode?: string;
  };
}

export function validateAfrolocCode(code: string): ValidationResult {
  const conversion = detectAndConvertLegacy(code);
  const c = conversion.newCode;

  if (c.includes('.') && !c.includes('@')) {
    return {
      valid: false,
      error: 'Legacy dot format requires coordinates suffix: CC....@lat,lon',
    };
  }

  const parts = c.split('-');
  const coordPattern = /^(N?[A-Z0-9]+)$/;

  if (parts.length === 7) {
    // CC-MUN-COM-BAI-G10-X-Y (formato oficial)
    const [country, mun, com, bai, gpart, xpart, ypart] = parts;

    if (!/^[A-Z]{2}$/.test(country)) {
      return { valid: false, error: 'Invalid country code: must be 2 uppercase letters' };
    }
    if (!/^[A-Z0-9]{2,4}$/.test(mun)) {
      return { valid: false, error: 'Invalid municipality code: must be 2-4 alphanumeric characters' };
    }
    if (!/^[A-Z0-9]{2,4}$/.test(com)) {
      return { valid: false, error: 'Invalid commune code: must be 2-4 alphanumeric characters' };
    }
    if (!/^[A-Z0-9]{2,4}$/.test(bai)) {
      return { valid: false, error: 'Invalid neighborhood code: must be 2-4 alphanumeric characters' };
    }
    if (!gpart.startsWith('G') || !/^G\d+$/.test(gpart)) {
      return { valid: false, error: 'Invalid grid: must be G followed by number (e.g., G10, G25)' };
    }
    const gridSize = parseInt(gpart.slice(1), 10);
    if (![10, 25].includes(gridSize)) {
      return { valid: false, error: 'Invalid grid size: must be G10 (urban) or G25 (rural)' };
    }
    if (!coordPattern.test(xpart) || !coordPattern.test(ypart)) {
      return { valid: false, error: 'Invalid coordinates: must be base36 with optional N prefix' };
    }

    return {
      valid: true,
      normalizedCode: c,
      wasConverted: conversion.converted,
      originalFormat: conversion.originalFormat,
      format: 'official',
      extractedAdmin: { municipalityCode: mun, communeCode: com, neighborhoodCode: bai },
    };
  } else if (parts.length === 6) {
    // CC-MUN-COM-G10-X-Y (formato parcial)
    const [country, mun, com, gpart, xpart, ypart] = parts;

    if (!/^[A-Z]{2}$/.test(country)) {
      return { valid: false, error: 'Invalid country code: must be 2 uppercase letters' };
    }
    if (!/^[A-Z0-9]{2,4}$/.test(mun)) {
      return { valid: false, error: 'Invalid municipality code: must be 2-4 alphanumeric characters' };
    }
    if (!/^[A-Z0-9]{2,4}$/.test(com)) {
      return { valid: false, error: 'Invalid commune code: must be 2-4 alphanumeric characters' };
    }
    if (!gpart.startsWith('G') || !/^G\d+$/.test(gpart)) {
      return { valid: false, error: 'Invalid grid: must be G followed by number' };
    }
    const gridSize = parseInt(gpart.slice(1), 10);
    if (![10, 25].includes(gridSize)) {
      return { valid: false, error: 'Invalid grid size: must be G10 or G25' };
    }
    if (!coordPattern.test(xpart) || !coordPattern.test(ypart)) {
      return { valid: false, error: 'Invalid coordinates' };
    }

    return {
      valid: true,
      normalizedCode: c,
      wasConverted: conversion.converted,
      originalFormat: conversion.originalFormat,
      format: 'partial',
      extractedAdmin: { municipalityCode: mun, communeCode: com },
    };
  } else if (parts.length === 5) {
    // CC-ZU-G10-X-Y (legacy) ou CC-MUN-G10-X-Y (mínimo)
    const [country, second, gpart, xpart, ypart] = parts;

    if (!/^[A-Z]{2}$/.test(country)) {
      return { valid: false, error: 'Invalid country code: must be 2 uppercase letters' };
    }

    const isZone = second === 'ZU' || second === 'ZR';
    if (!isZone && !/^[A-Z0-9]{2,4}$/.test(second)) {
      return { valid: false, error: 'Invalid zone or municipality code' };
    }

    if (!gpart.startsWith('G') || !/^G\d+$/.test(gpart)) {
      return { valid: false, error: 'Invalid grid: must be G followed by number' };
    }
    const gridSize = parseInt(gpart.slice(1), 10);
    if (![10, 25].includes(gridSize)) {
      return { valid: false, error: 'Invalid grid size: must be G10 or G25' };
    }

    if (!coordPattern.test(xpart) || !coordPattern.test(ypart)) {
      return { valid: false, error: 'Invalid coordinates' };
    }

    return {
      valid: true,
      normalizedCode: c,
      wasConverted: conversion.converted,
      originalFormat: conversion.originalFormat,
      format: isZone ? 'legacy' : 'minimal',
      extractedAdmin: isZone ? undefined : { municipalityCode: second },
    };
  } else if (parts.length === 3 && /^[A-Z]{2}$/.test(parts[0])) {
    return {
      valid: false,
      error: 'Incomplete code: expected CC-MUN-COM-BAI-G10-X-Y or CC-ZU-G10-X-Y',
    };
  }

  return {
    valid: false,
    error: `Invalid format: expected 5-7 parts, got ${parts.length} parts`,
  };
}

// --- Decode ---
export function decodeAfroloc(code: string): DecodeResponse & {
  wasConverted?: boolean;
  originalFormat?: string;
  format?: 'official' | 'partial' | 'minimal' | 'legacy';
} {
  const validation = validateAfrolocCode(code);

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const c = validation.normalizedCode!;
  const parts = c.split('-');

  let country: string;
  let zone: 'urban' | 'rural';
  let grid_m: number;
  let ix: number;
  let iy: number;
  let municipalityCode: string | undefined;
  let communeCode: string | undefined;
  let neighborhoodCode: string | undefined;

  if (parts.length === 7) {
    country = parts[0];
    municipalityCode = parts[1];
    communeCode = parts[2];
    neighborhoodCode = parts[3];
    grid_m = parseInt(parts[4].slice(1), 10);
    ix = fromBase36(parts[5]);
    iy = fromBase36(parts[6]);
    zone = grid_m === 10 ? 'urban' : 'rural';
  } else if (parts.length === 6) {
    country = parts[0];
    municipalityCode = parts[1];
    communeCode = parts[2];
    grid_m = parseInt(parts[3].slice(1), 10);
    ix = fromBase36(parts[4]);
    iy = fromBase36(parts[5]);
    zone = grid_m === 10 ? 'urban' : 'rural';
  } else {
    country = parts[0];
    const second = parts[1];
    grid_m = parseInt(parts[2].slice(1), 10);
    ix = fromBase36(parts[3]);
    iy = fromBase36(parts[4]);

    if (second === 'ZU' || second === 'ZR') {
      zone = second === 'ZU' ? 'urban' : 'rural';
    } else {
      municipalityCode = second;
      zone = grid_m === 10 ? 'urban' : 'rural';
    }
  }

  const minx = ix * grid_m;
  const miny = iy * grid_m;
  const maxx = (ix + 1) * grid_m;
  const maxy = (iy + 1) * grid_m;

  const sw = mercatorToLonLat(minx, miny);
  const ne = mercatorToLonLat(maxx, maxy);

  const cx = (minx + maxx) / 2;
  const cy = (miny + maxy) / 2;
  const cent = mercatorToLonLat(cx, cy);

  const zoneTag = zone === 'urban' ? 'ZU' : 'ZR';
  const xCode = toBase36(ix);
  const yCode = toBase36(iy);
  const legacyCode = `${country}-${zoneTag}-G${grid_m}-${xCode}-${yCode}`;

  return {
    afroloc: c,
    afrolocLegacy: legacyCode,
    country,
    zone,
    grid_m,
    tile_ix: ix,
    tile_iy: iy,
    municipalityCode,
    communeCode,
    neighborhoodCode,
    bbox: { minLon: sw.lon, minLat: sw.lat, maxLon: ne.lon, maxLat: ne.lat },
    centroid: { lon: cent.lon, lat: cent.lat },
    wasConverted: validation.wasConverted,
    originalFormat: validation.originalFormat,
    format: validation.format,
  };
}

// --- Adaptador para o gateway (assinatura histórica {valid, normalized, error}) ---
export function normalizeAfrolocCode(code: string): { valid: boolean; normalized: string; error?: string } {
  if (!code || typeof code !== 'string') {
    return { valid: false, normalized: '', error: 'Code is required' };
  }
  const v = validateAfrolocCode(code);
  if (!v.valid) {
    return {
      valid: false,
      normalized: '',
      error: v.error || `Unrecognized AFROLOC code format: ${code}. Expected: CC-ZU-G10-xxxx-yyyy or CC-PROV-MUN[-COM[-BAI]]-G10-xxxx-yyyy (X/Y prefixes tolerated)`,
    };
  }
  return { valid: true, normalized: v.normalizedCode! };
}

/**
 * Formas equivalentes de um código canónico, para lookups em BD onde
 * registos históricos podem ter sido gravados com prefixos X/Y.
 * Devolve [canónica, prefixada] sem duplicados.
 */
export function codeForms(normalized: string): string[] {
  const parts = normalized.split('-');
  if (parts.length < 5) return [normalized];
  const prefixed = [
    ...parts.slice(0, -2),
    'X' + parts[parts.length - 2],
    'Y' + parts[parts.length - 1],
  ].join('-');
  return prefixed === normalized ? [normalized] : [normalized, prefixed];
}
