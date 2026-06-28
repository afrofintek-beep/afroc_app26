/**
 * @afroloc/sdk — Standalone AFROLOC Geospatial SDK
 * Copyright © 2025 AFROFINTEK GmbH. All rights reserved.
 * 
 * Pure functions for AFROLOC code encode/decode/resolve/validate.
 * No external dependencies — works in browser, Node.js, Deno, and Edge Functions.
 * 
 * Usage:
 *   import { encode, decode, validate, resolve, generateDeepLink } from '@/lib/afroloc/sdk';
 *   
 *   const code = encode(-8.838, 13.234, 'AO', 'urban');
 *   const geo  = decode(code);
 *   const ok   = validate(code);
 */

// ─── Constants ───────────────────────────────────────────────────

const EARTH_RADIUS = 6378137;
const MAX_LAT = 85.0511287798;

const AFRICAN_COUNTRIES = new Set([
  'AO','BJ','BW','BF','BI','CM','CV','CF','TD','KM','CG','CD','CI','DJ',
  'EG','GQ','ER','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG',
  'MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL',
  'SO','ZA','SS','SD','SZ','TZ','TG','TN','UG','ZM','ZW',
]);

// Legacy format patterns for backward compatibility
const LEGACY_PATTERNS = {
  hyphenNegative: /^([A-Z]{2})-(Z[UR])-(G\d+)-(-?\d+)-(-?\d+)$/,
  missingG: /^([A-Z]{2})-(Z[UR])-(\d+)-X([A-Z0-9N]+)-Y([A-Z0-9N]+)$/i,
  oldZoneTags: /^([A-Z]{2})-(URBAN|RURAL)-(G\d+)-X([A-Z0-9N]+)-Y([A-Z0-9N]+)$/i,
};

const STANDARD_PATTERN = /^([A-Z]{2})-(Z[UR])-(G\d+)-X([A-Z0-9N]+)-Y([A-Z0-9N]+)$/;
const NOMENCLATURE_PATTERN = /^([A-Z]{2})-([A-Z]{3})-([A-Z]{3})-([A-Z]{3})-G(\d+)-([A-Z0-9N]+)-([A-Z0-9N]+)$/;

// ─── Types ───────────────────────────────────────────────────────

export type Zone = 'urban' | 'rural';

export interface EncodeResult {
  code: string;
  zone: Zone;
  gridSize: 10 | 25;
  ix: number;
  iy: number;
}

export interface DecodeResult {
  countryCode: string;
  zone: Zone;
  gridSize: number;
  ix: number;
  iy: number;
  centroid: { lat: number; lon: number };
  bbox: {
    minLat: number; maxLat: number;
    minLon: number; maxLon: number;
  };
}

export interface ValidateResult {
  valid: boolean;
  normalizedCode?: string;
  wasConverted: boolean;
  originalFormat?: string;
  error?: string;
}

export interface ResolveOptions {
  /** Base URL of the AFROLOC API (e.g. https://xxx.supabase.co/functions/v1) */
  apiBaseUrl: string;
  /** API key for authentication */
  apiKey: string;
}

// ─── Core: Web Mercator Projection ──────────────────────────────

function toMercator(lat: number, lon: number): { x: number; y: number } {
  const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const x = EARTH_RADIUS * (lon * Math.PI / 180);
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + clampedLat * Math.PI / 360));
  return { x, y };
}

function fromMercator(x: number, y: number): { lat: number; lon: number } {
  const lon = (x / EARTH_RADIUS) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * (180 / Math.PI);
  return { lat, lon };
}

function encodeCoord(n: number): string {
  const prefix = n < 0 ? 'N' : '';
  return prefix + Math.abs(n).toString(36).toUpperCase();
}

function decodeCoord(s: string): number {
  if (s.startsWith('N') || s.startsWith('n')) {
    return -parseInt(s.substring(1), 36);
  }
  return parseInt(s, 36);
}

// ─── Encode: lat/lon → AFROLOC code ─────────────────────────────

/**
 * Encode geographic coordinates into an AFROLOC grid code.
 * 
 * @param lat - Latitude (-85 to 85)
 * @param lon - Longitude (-180 to 180)
 * @param countryCode - ISO 3166-1 alpha-2 country code (must be African)
 * @param zone - 'urban' (10m grid) or 'rural' (25m grid)
 * @returns EncodeResult with code and metadata
 * 
 * @example
 * encode(-8.838, 13.234, 'AO', 'urban')
 * // → { code: 'AO-ZU-G10-X35O8-YN247T', zone: 'urban', gridSize: 10, ... }
 */
export function encode(lat: number, lon: number, countryCode: string, zone: Zone): EncodeResult {
  if (!AFRICAN_COUNTRIES.has(countryCode.toUpperCase())) {
    throw new Error(`Invalid African country code: ${countryCode}`);
  }
  if (lat < -MAX_LAT || lat > MAX_LAT) {
    throw new Error(`Latitude out of range: ${lat}`);
  }
  if (lon < -180 || lon > 180) {
    throw new Error(`Longitude out of range: ${lon}`);
  }

  const gridSize = zone === 'urban' ? 10 : 25;
  const zoneTag = zone === 'urban' ? 'ZU' : 'ZR';
  const gridTag = zone === 'urban' ? 'G10' : 'G25';

  const { x, y } = toMercator(lat, lon);
  const ix = Math.floor(x / gridSize);
  const iy = Math.floor(y / gridSize);

  const code = `${countryCode.toUpperCase()}-${zoneTag}-${gridTag}-X${encodeCoord(ix)}-Y${encodeCoord(iy)}`;

  return { code, zone, gridSize, ix, iy };
}

// ─── Decode: AFROLOC code → lat/lon + bbox ──────────────────────

/**
 * Decode an AFROLOC code to geographic coordinates.
 * Supports both standard and nomenclature formats.
 * Automatically detects and converts legacy formats.
 * 
 * @param code - AFROLOC code string
 * @returns DecodeResult with centroid, bbox, and metadata
 * 
 * @example
 * decode('AO-ZU-G10-X35O8-YN247T')
 * // → { centroid: { lat: -8.838, lon: 13.234 }, bbox: {...}, ... }
 */
export function decode(code: string): DecodeResult {
  // Try to normalize first
  const validated = validate(code);
  const normalizedCode = validated.valid ? (validated.normalizedCode || code) : code;

  // Standard format: CC-ZU-G10-Xxxxx-Yyyyy
  const stdMatch = normalizedCode.match(STANDARD_PATTERN);
  if (stdMatch) {
    const [, countryCode, zoneStr, gridStr, xPart, yPart] = stdMatch;
    const zone: Zone = zoneStr === 'ZU' ? 'urban' : 'rural';
    const gridSize = parseInt(gridStr.replace('G', ''));
    const ix = decodeCoord(xPart);
    const iy = decodeCoord(yPart);

    const minX = ix * gridSize;
    const minY = iy * gridSize;
    const maxX = minX + gridSize;
    const maxY = minY + gridSize;

    const minCorner = fromMercator(minX, minY);
    const maxCorner = fromMercator(maxX, maxY);
    const center = fromMercator(minX + gridSize / 2, minY + gridSize / 2);

    return {
      countryCode,
      zone,
      gridSize,
      ix, iy,
      centroid: center,
      bbox: {
        minLat: minCorner.lat,
        maxLat: maxCorner.lat,
        minLon: minCorner.lon,
        maxLon: maxCorner.lon,
      },
    };
  }

  // Nomenclature format: CC-MUN-COM-BAI-G10-xxxxx-yyyyy
  const nomMatch = normalizedCode.match(NOMENCLATURE_PATTERN);
  if (nomMatch) {
    const [, countryCode, , , , gridStr, xPart, yPart] = nomMatch;
    const gridSize = parseInt(gridStr);
    const zone: Zone = gridSize <= 10 ? 'urban' : 'rural';
    const ix = decodeCoord(xPart);
    const iy = decodeCoord(yPart);

    const minX = ix * gridSize;
    const minY = iy * gridSize;
    const maxX = minX + gridSize;
    const maxY = minY + gridSize;

    const minCorner = fromMercator(minX, minY);
    const maxCorner = fromMercator(maxX, maxY);
    const center = fromMercator(minX + gridSize / 2, minY + gridSize / 2);

    return {
      countryCode,
      zone,
      gridSize,
      ix, iy,
      centroid: center,
      bbox: {
        minLat: minCorner.lat,
        maxLat: maxCorner.lat,
        minLon: minCorner.lon,
        maxLon: maxCorner.lon,
      },
    };
  }

  throw new Error(`Cannot decode AFROLOC code: ${code}`);
}

// ─── Validate: check and normalize code format ──────────────────

/**
 * Validate an AFROLOC code. Detects and converts legacy formats.
 * 
 * @param code - AFROLOC code string to validate
 * @returns ValidateResult with validity, normalized code, and conversion info
 */
export function validate(code: string): ValidateResult {
  if (!code || typeof code !== 'string') {
    return { valid: false, wasConverted: false, error: 'Code is required' };
  }

  const trimmed = code.trim().toUpperCase();

  // Check standard format
  if (STANDARD_PATTERN.test(trimmed)) {
    return { valid: true, normalizedCode: trimmed, wasConverted: false };
  }

  // Check nomenclature format
  if (NOMENCLATURE_PATTERN.test(trimmed)) {
    return { valid: true, normalizedCode: trimmed, wasConverted: false };
  }

  // Try legacy: hyphen-negative (e.g. AO-ZU-G10-3658--2484)
  const hyphenMatch = trimmed.match(LEGACY_PATTERNS.hyphenNegative);
  if (hyphenMatch) {
    const [, cc, zt, gt, xVal, yVal] = hyphenMatch;
    const ix = parseInt(xVal);
    const iy = parseInt(yVal);
    const normalized = `${cc}-${zt}-${gt}-X${encodeCoord(ix)}-Y${encodeCoord(iy)}`;
    return {
      valid: true,
      normalizedCode: normalized,
      wasConverted: true,
      originalFormat: 'hyphen-negative',
    };
  }

  // Try legacy: old zone tags (URBAN/RURAL instead of ZU/ZR)
  const oldZoneMatch = trimmed.match(LEGACY_PATTERNS.oldZoneTags);
  if (oldZoneMatch) {
    const [, cc, zone, gt, xPart, yPart] = oldZoneMatch;
    const zt = zone === 'URBAN' ? 'ZU' : 'ZR';
    const normalized = `${cc}-${zt}-${gt}-X${xPart}-Y${yPart}`;
    return {
      valid: true,
      normalizedCode: normalized,
      wasConverted: true,
      originalFormat: 'old-zone-tags',
    };
  }

  return {
    valid: false,
    wasConverted: false,
    error: `Unrecognized AFROLOC code format: ${code}`,
  };
}

// ─── Resolve: online resolution via API ─────────────────────────

/**
 * Resolve coordinates to an AFROLOC code via the backend API.
 * This uses the server-side PostGIS zone detection (source of truth).
 * 
 * @param lat - Latitude
 * @param lon - Longitude
 * @param countryCode - Country code
 * @param options - API connection options
 */
export async function resolve(
  lat: number, lon: number, countryCode: string,
  options: ResolveOptions
): Promise<EncodeResult & { serverZone: string }> {
  const response = await fetch(`${options.apiBaseUrl}/qg-engine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({ latitude: lat, longitude: lon, countryCode }),
  });

  if (!response.ok) {
    throw new Error(`Resolve failed: ${await response.text()}`);
  }

  const result = await response.json();
  return {
    code: result.afroloc || result.qgCode,
    zone: result.zone,
    gridSize: result.grid_m,
    ix: result.ix || 0,
    iy: result.iy || 0,
    serverZone: result.zone,
  };
}

/**
 * Batch resolve multiple coordinates via the backend API.
 */
export interface BatchResolveResult {
  results: Array<{
    id?: string;
    code: string;
    zone: Zone;
    gridSize: number;
    centroid: { lat: number; lon: number };
    error?: string;
  }>;
  total: number;
  resolved: number;
  failed: number;
}

export async function batchResolve(
  points: Array<{ id?: string; latitude: number; longitude: number; countryCode?: string }>,
  defaultCountry: string,
  options: ResolveOptions
): Promise<BatchResolveResult> {
  const response = await fetch(`${options.apiBaseUrl}/batch-resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({ points, countryCode: defaultCountry }),
  });

  if (!response.ok) {
    throw new Error(`Batch resolve failed: ${await response.text()}`);
  }

  return response.json();
}

// ─── Utilities ──────────────────────────────────────────────────

/**
 * Check if a country code is a valid African country.
 */
export function isAfricanCountry(code: string): boolean {
  return AFRICAN_COUNTRIES.has(code.toUpperCase());
}

/**
 * Calculate Haversine distance between two points in meters.
 */
export function distance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Generate deep link URLs for an AFROLOC code.
 */
export function deepLink(
  action: 'address' | 'checkin' | 'verify' | 'qr',
  code: string,
  webBaseUrl?: string
): { native: string; web: string } {
  const base = webBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return {
    native: `afroloc://${action}/${code}`,
    web: `${base}/dl/${action}/${code}`,
  };
}

// ─── SQ: Adaptive Subdivision (Offline) ─────────────────────────

export type DensityClass = 'low' | 'medium' | 'high' | 'very_high';
export type SubdivisionType = '2x2' | '3x3' | '4x4' | '5x5';

/** Density thresholds for adaptive subdivision */
export const DENSITY_THRESHOLDS = {
  low: 10,       // ≤10 certs → 2×2 (4 sub-cells)
  medium: 50,    // ≤50 certs → 3×3 (9 sub-cells)
  high: 150,     // ≤150 certs → 4×4 (16 sub-cells)
  very_high: Infinity, // >150 certs → 5×5 (25 sub-cells)
} as const;

/** Subdivision labels per type */
export const SQ_LABELS: Record<SubdivisionType, string[]> = {
  '2x2': ['A', 'B', 'C', 'D'],
  '3x3': ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  '4x4': [
    'A1', 'A2', 'A3', 'A4',
    'B1', 'B2', 'B3', 'B4',
    'C1', 'C2', 'C3', 'C4',
    'D1', 'D2', 'D3', 'D4',
  ],
  '5x5': [
    'A1', 'A2', 'A3', 'A4', 'A5',
    'B1', 'B2', 'B3', 'B4', 'B5',
    'C1', 'C2', 'C3', 'C4', 'C5',
    'D1', 'D2', 'D3', 'D4', 'D5',
    'E1', 'E2', 'E3', 'E4', 'E5',
  ],
};

export interface SQEncodeResult {
  sqLabel: string;
  sqCode: string;
  fullCode: string;
  subdivisionType: SubdivisionType;
  gridSize: number;
  subCellBounds: {
    minLat: number; maxLat: number;
    minLon: number; maxLon: number;
  };
}

/**
 * Determine density class from certification count.
 */
export function classifyDensity(certCount: number): DensityClass {
  if (certCount <= DENSITY_THRESHOLDS.low) return 'low';
  if (certCount <= DENSITY_THRESHOLDS.medium) return 'medium';
  if (certCount <= DENSITY_THRESHOLDS.high) return 'high';
  return 'very_high';
}

/**
 * Map density class → subdivision type.
 */
export function densityToSubdivision(densityClass: DensityClass): SubdivisionType {
  switch (densityClass) {
    case 'low': return '2x2';
    case 'medium': return '3x3';
    case 'high': return '4x4';
    case 'very_high': return '5x5';
  }
}

/**
 * Get the grid dimension (N) from a subdivision type string.
 */
function subdivisionDim(t: SubdivisionType): number {
  return parseInt(t[0]);
}

/**
 * Compute which sub-cell index (row-major) a point falls into.
 */
function subCellIndex(
  lat: number, lon: number,
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  dim: number
): number {
  const normLat = (lat - bbox.minLat) / (bbox.maxLat - bbox.minLat);
  const normLon = (lon - bbox.minLon) / (bbox.maxLon - bbox.minLon);
  const row = Math.floor((1 - normLat) * dim);
  const col = Math.floor(normLon * dim);
  return Math.max(0, Math.min(dim - 1, row)) * dim + Math.max(0, Math.min(dim - 1, col));
}

/**
 * Compute sub-cell bounds from parent bounds, dimension, and index.
 */
function subCellBounds(
  parent: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  dim: number,
  idx: number
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const row = Math.floor(idx / dim);
  const col = idx % dim;
  const latStep = (parent.maxLat - parent.minLat) / dim;
  const lonStep = (parent.maxLon - parent.minLon) / dim;
  return {
    maxLat: parent.maxLat - row * latStep,
    minLat: parent.maxLat - (row + 1) * latStep,
    minLon: parent.minLon + col * lonStep,
    maxLon: parent.minLon + (col + 1) * lonStep,
  };
}

/**
 * Encode SQ subdivision for a point within a decoded QG cell (offline).
 * 
 * @param lat - Point latitude
 * @param lon - Point longitude
 * @param afrolocCode - The parent QG AFROLOC code
 * @param certCount - Number of certifications in the cell (determines subdivision granularity)
 * @returns SQEncodeResult with label, code, bounds
 * 
 * @example
 * const sq = encodeSQ(-8.838, 13.234, 'AO-ZU-G10-X35O8-YN247T', 75);
 * // → { sqCode: 'SQ44-C2', fullCode: 'AO-ZU-G10-X35O8-YN247T-SQ44-C2', subdivisionType: '4x4', ... }
 */
export function encodeSQ(
  lat: number, lon: number,
  afrolocCode: string,
  certCount: number = 0
): SQEncodeResult {
  const decoded = decode(afrolocCode);
  const densityClass = classifyDensity(certCount);
  const subdivType = densityToSubdivision(densityClass);
  const dim = subdivisionDim(subdivType);
  const idx = subCellIndex(lat, lon, decoded.bbox, dim);
  const labels = SQ_LABELS[subdivType];
  const label = labels[idx] || '?';
  const bounds = subCellBounds(decoded.bbox, dim, idx);
  const sqCode = `SQ${dim}${dim}-${label}`;

  return {
    sqLabel: label,
    sqCode,
    fullCode: `${afrolocCode}-${sqCode}`,
    subdivisionType: subdivType,
    gridSize: dim,
    subCellBounds: bounds,
  };
}

/**
 * Decode an SQ suffix to get the sub-cell bounds within a parent cell.
 * 
 * @param fullCode - Full AFROLOC+SQ code (e.g. 'AO-ZU-G10-X35O8-YN247T-SQ44-C2')
 * @returns decoded parent + sub-cell bounds, or null if no SQ suffix
 */
export function decodeSQ(fullCode: string): (DecodeResult & { sq: { label: string; subdivisionType: SubdivisionType; subCellBounds: { minLat: number; maxLat: number; minLon: number; maxLon: number } } }) | null {
  const sqMatch = fullCode.match(/^(.+)-SQ(\d)(\d)-(.+)$/);
  if (!sqMatch) return null;

  const [, parentCode, dimRow, dimCol, label] = sqMatch;
  if (dimRow !== dimCol) return null;

  const dim = parseInt(dimRow);
  const subdivType = `${dim}x${dim}` as SubdivisionType;
  const labels = SQ_LABELS[subdivType];
  if (!labels) return null;

  const idx = labels.indexOf(label);
  if (idx === -1) return null;

  const parent = decode(parentCode);
  const bounds = subCellBounds(parent.bbox, dim, idx);

  return {
    ...parent,
    sq: { label, subdivisionType: subdivType, subCellBounds: bounds },
  };
}

/**
 * Calculate growth rate between two certification snapshots.
 */
export function calculateGrowthRate(
  currentCount: number,
  previousCount: number,
  daysBetween: number = 30
): number {
  if (previousCount <= 0) return currentCount > 0 ? 100 : 0;
  const raw = ((currentCount - previousCount) / previousCount) * 100;
  // Annualize: scale to 365 days
  return Math.round((raw / daysBetween) * 365 * 100) / 100;
}

/**
 * SDK version and metadata
 */
export const SDK = {
  name: '@afroloc/sdk',
  version: '1.1.0',
  projection: 'EPSG:3857 (Web Mercator)',
  gridSizes: { urban: 10, rural: 25 },
  unit: 'meters',
  sqSubdivisions: ['2x2', '3x3', '4x4', '5x5'],
} as const;
