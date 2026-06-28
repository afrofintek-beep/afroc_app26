/**
 * AFROLOC Edge Function
 * 
 * Copyright (c) 2024-2026 AFROFINTEK GmbH. All rights reserved.
 * 
 * This file is part of the AFROLOC backend infrastructure.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited.
 * 
 * For API documentation, see: /v1-docs
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

/**
 * AFROLOC QG ENGINE — NATIONAL GEOSPATIAL GRID
 * 
 * NOMENCLATURA OFICIAL:
 * CC-PROV-MUN-COM-BAI-G10-X-Y (com hierarquia administrativa)
 * 
 * Onde:
 * - CC: Código do país (2 letras ISO)
 * - PROV: Código da província (3 letras)
 * - MUN: Código do município (3 letras)
 * - COM: Código da comuna (3 letras)
 * - BAI: Código do bairro (3 letras)
 * - G10/G25: Tamanho da célula (10m urbano, 25m rural)
 * - X: Coordenada X em base36
 * - Y: Coordenada Y em base36
 * 
 * Formato alternativo sem hierarquia completa:
 * CC-ZU-G10-X-Y (legacy, ainda suportado para compatibilidade)
 * 
 * WGS84 lat/lon -> WebMercator meters -> tile indices
 * Urban: 10m | Rural: 25m
 */

// Constants
const R = 6378137.0; // WGS84 radius used by WebMercator
const MAX_LAT = 85.05112878;

// Grid sizes in meters
const URBAN_CELL_SIZE = 10;
const RURAL_CELL_SIZE = 25;

interface QGRequest {
  latitude: number;
  longitude: number;
  countryCode: string;
  cellType?: 'urban' | 'rural' | 'auto';
  adminPath?: string; // For zone resolution by keywords
  // Campos administrativos para o novo formato
  provinceCode?: string;
  municipalityCode?: string;
  communeCode?: string;
  neighborhoodCode?: string;
  // Tipo de registo: 'formal' (com bairro) ou 'digital' (sem bairro, só GPS)
  registrationType?: 'formal' | 'digital';
}

interface QGResponse {
  afroloc: string;
  afrolocLegacy?: string; // Código no formato antigo para compatibilidade
  country: string;
  zone: 'urban' | 'rural';
  grid_m: number;
  tile_ix: number;
  tile_iy: number;
  // Campos administrativos
  provinceCode?: string;
  municipalityCode?: string;
  communeCode?: string;
  neighborhoodCode?: string;
  bbox: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  };
  centroid: {
    lon: number;
    lat: number;
  };
  webMercator: {
    x: number;
    y: number;
  };
}

interface DecodeRequest {
  code: string;
}

interface DecodeResponse extends Omit<QGResponse, 'webMercator'> {}

// --- Utilities ---
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function deg(r: number): number {
  return (r * 180) / Math.PI;
}

// Base36 that supports negatives (prefix "N" for negative)
function toBase36(n: number): string {
  if (n === 0) return "0";
  const x = Math.abs(Math.trunc(n));
  const prefix = n < 0 ? "N" : "";
  return prefix + x.toString(36).toUpperCase();
}

function fromBase36(s: string): number {
  const str = String(s).toUpperCase();
  if (str.startsWith("N")) return -parseInt(str.slice(1), 36);
  if (str.startsWith("-")) return -parseInt(str.slice(1), 36);
  return parseInt(str, 36);
}

// --- WebMercator (EPSG:3857) ---
function lonLatToMercator(lon: number, lat: number): { x: number; y: number } {
  const clat = clamp(lat, -MAX_LAT, MAX_LAT);
  const x = R * rad(lon);
  const y = R * Math.log(Math.tan(Math.PI / 4 + rad(clat) / 2));
  return { x, y };
}

function mercatorToLonLat(x: number, y: number): { lon: number; lat: number } {
  const lon = deg(x / R);
  const lat = deg(2 * Math.atan(Math.exp(y / R)) - Math.PI / 2);
  return { lon, lat };
}

// --- Zone Detection ---
// Urban keywords for major African cities
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

// Major city coordinates for fallback detection
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
    if (pathUpper.includes(keyword)) {
      return 'urban';
    }
  }
  return null;
}

function resolveZoneByCoordinates(lat: number, lon: number, countryCode: string): 'urban' | 'rural' {
  const centers = URBAN_CENTERS[countryCode] || [];
  
  for (const center of centers) {
    const distance = Math.sqrt(
      Math.pow(lat - center.lat, 2) + Math.pow(lon - center.lon, 2)
    );
    if (distance <= center.radius) {
      return 'urban';
    }
  }
  
  return 'rural';
}

function resolveZone(lat: number, lon: number, countryCode: string, adminPath?: string): 'urban' | 'rural' {
  // Try keyword-based resolution first
  if (adminPath) {
    const keywordResult = resolveZoneByKeywords(countryCode, adminPath);
    if (keywordResult) return keywordResult;
  }
  
  // Fall back to coordinate-based detection
  return resolveZoneByCoordinates(lat, lon, countryCode);
}

// --- Core: encode ---
function encodeAfroloc(request: QGRequest): QGResponse {
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
    registrationType = 'formal'
  } = request;
  
  // Determine zone
  let zone: 'urban' | 'rural';
  if (cellType && cellType !== 'auto') {
    zone = cellType;
  } else {
    zone = resolveZone(latitude, longitude, countryCode, adminPath);
  }
  
  const gridSize = zone === 'urban' ? URBAN_CELL_SIZE : RURAL_CELL_SIZE;
  const { x, y } = lonLatToMercator(longitude, latitude);
  
  // Tile indices (integer)
  const ix = Math.floor(x / gridSize);
  const iy = Math.floor(y / gridSize);
  
  // Build coordinates part
  const cc = countryCode.toUpperCase();
  const xCode = toBase36(ix);
  const yCode = toBase36(iy);
  const gridTag = `G${gridSize}`;
  
  // Build code based on available administrative data
  let code: string;
  let legacyCode: string;
  
  // Normalizar códigos administrativos para 3 caracteres maiúsculos
  const normProv = provinceCode?.toUpperCase().slice(0, 3) || '';
  const normMun = municipalityCode?.toUpperCase().slice(0, 3) || '';
  const normCom = communeCode?.toUpperCase().slice(0, 3) || '';
  // Para registos digitais, usar "DIG" como código do bairro
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
    // Fallback sem província (legacy)
    if (registrationType === 'digital') {
      code = `${cc}-${normMun}-DIG-${gridTag}-${xCode}-${yCode}`;
    } else {
      code = `${cc}-${normMun}-${gridTag}-${xCode}-${yCode}`;
    }
  } else {
    // Formato legacy: CC-ZU-G10-X-Y ou CC-DIG-G10-X-Y
    if (registrationType === 'digital') {
      code = `${cc}-DIG-${gridTag}-${xCode}-${yCode}`;
    } else {
      const zoneTag = zone === 'urban' ? 'ZU' : 'ZR';
      code = `${cc}-${zoneTag}-${gridTag}-${xCode}-${yCode}`;
    }
  }
  
  // Sempre gerar também o código legacy para compatibilidade
  const zoneTag = zone === 'urban' ? 'ZU' : 'ZR';
  legacyCode = `${cc}-${zoneTag}-${gridTag}-${xCode}-${yCode}`;
  
  // BBox in mercator meters
  const minx = ix * gridSize;
  const miny = iy * gridSize;
  const maxx = (ix + 1) * gridSize;
  const maxy = (iy + 1) * gridSize;
  
  // BBox + centroid in lon/lat
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
    bbox: {
      minLon: sw.lon,
      minLat: sw.lat,
      maxLon: ne.lon,
      maxLat: ne.lat,
    },
    centroid: { lon: c.lon, lat: c.lat },
    webMercator: { x, y },
  };
}

// --- Legacy Code Detection and Conversion ---
interface LegacyConversionResult {
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
 * Detects and processes AFROLOC code formats.
 * 
 * Supported formats:
 * 1. OFFICIAL: CC-MUN-COM-BAI-G10-X-Y (7 parts - full hierarchy)
 * 2. PARTIAL: CC-MUN-COM-G10-X-Y (6 parts - without neighborhood)
 * 3. MINIMAL: CC-MUN-G10-X-Y (5 parts - municipality only)
 * 4. LEGACY: CC-ZU-G10-X-Y (5 parts - zone-based)
 * 
 * Legacy sub-formats (auto-converted):
 * - Old hyphen-negative: CC-ZU-G10-X-123-Y-456
 * - Old combined XY: CC-ZU-G10-X123Y456
 * - Missing G prefix: CC-ZU-10-123-456
 * - Old QG prefix: CC-QG-G10-123-456
 */
function detectAndConvertLegacy(code: string): LegacyConversionResult {
  let c = code.trim().toUpperCase();
  
  // Fix common OCR/typo errors in country codes (0 -> O, 1 -> I)
  // Only apply to first 2 characters (country code position)
  if (c.length >= 2) {
    const firstTwo = c.substring(0, 2)
      .replace(/0/g, 'O')  // zero -> letter O
      .replace(/1/g, 'I'); // one -> letter I
    c = firstTwo + c.substring(2);
  }
  
  // Format 0: Old dot-separated format with embedded coordinates
  // e.g., AO.LUA.TAL.XXX.YYY.GE-57.H@-8.9330,13.1825
  if (c.includes('.') && c.includes('@')) {
    const atIndex = c.indexOf('@');
    const coordPart = c.substring(atIndex + 1);
    const codePart = c.substring(0, atIndex);
    
    // Extract coordinates from @lat,lon format
    const coordMatch = coordPart.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      
      // Extract country code and admin hierarchy (first segments)
      const segments = codePart.split('.');
      const countryCode = segments[0];
      const municipalityCode = segments[1] || undefined;
      const communeCode = segments[2] || undefined;
      const neighborhoodCode = segments[3] || undefined;
      
      if (/^[A-Z]{2}$/.test(countryCode) && !isNaN(lat) && !isNaN(lon)) {
        // Regenerate AFROLOC code from coordinates with admin info
        const encoded = encodeAfroloc({ 
          latitude: lat, 
          longitude: lon, 
          countryCode, 
          cellType: 'auto',
          municipalityCode,
          communeCode,
          neighborhoodCode
        });
        return { 
          converted: true, 
          newCode: encoded.afroloc, 
          originalFormat: 'dot-coordinate-legacy',
          extractedAdmin: { municipalityCode, communeCode, neighborhoodCode }
        };
      }
    }
  }
  
  // Format 0b: Old dot-separated format without coordinates
  if (c.includes('.') && !c.includes('-')) {
    return { converted: false, newCode: c };
  }
  
  let parts = c.split('-');
  
  // Format 1: Old hyphen-negative format (6+ parts due to negative numbers)
  if (parts.length > 7) {
    // Find and merge negative number parts
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
  
  // Format 2: Old combined XY format (adjust based on expected parts)
  // Look for X123Y456 pattern in any position
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
  
  // Format 3: Missing G prefix - find grid part and add G
  for (let i = 0; i < parts.length; i++) {
    if (/^\d+$/.test(parts[i]) && (parts[i] === '10' || parts[i] === '25')) {
      parts[i] = 'G' + parts[i];
      c = parts.join('-');
      break;
    }
  }
  
  // Format 4: Old QG prefix instead of ZU/ZR
  if (parts.length >= 2 && parts[1] === 'QG') {
    parts[1] = 'ZU';
    c = parts.join('-');
    return { converted: true, newCode: c, originalFormat: 'qg-prefix' };
  }
  
  // Format 5: SQ-based codes (remove SQ suffix)
  if (parts.some(p => p.startsWith('SQ'))) {
    const sqIndex = parts.findIndex(p => p.startsWith('SQ'));
    parts = parts.slice(0, sqIndex);
    c = parts.join('-');
    return { converted: true, newCode: c, originalFormat: 'sq-suffix' };
  }
  
  // Check if code matches new official format and extract admin codes
  if (parts.length === 7) {
    // CC-MUN-COM-BAI-G10-X-Y
    const [country, mun, com, bai, grid, x, y] = parts;
    if (/^[A-Z]{2}$/.test(country) && /^G\d+$/.test(grid)) {
      return { 
        converted: false, 
        newCode: c,
        extractedAdmin: {
          municipalityCode: mun,
          communeCode: com,
          neighborhoodCode: bai
        }
      };
    }
  } else if (parts.length === 6) {
    // CC-MUN-COM-G10-X-Y
    const [country, mun, com, grid, x, y] = parts;
    if (/^[A-Z]{2}$/.test(country) && /^G\d+$/.test(grid)) {
      return { 
        converted: false, 
        newCode: c,
        extractedAdmin: {
          municipalityCode: mun,
          communeCode: com
        }
      };
    }
  } else if (parts.length === 5) {
    // Could be CC-MUN-G10-X-Y or CC-ZU-G10-X-Y
    const [country, second, grid, x, y] = parts;
    if (/^[A-Z]{2}$/.test(country) && /^G\d+$/.test(grid)) {
      if (second !== 'ZU' && second !== 'ZR') {
        // It's a municipality code
        return { 
          converted: false, 
          newCode: c,
          extractedAdmin: { municipalityCode: second }
        };
      }
    }
  }
  
  return { converted: false, newCode: c };
}

/**
 * Validates an AFROLOC code and returns validation details.
 */
function validateAfrolocCode(code: string): { 
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
} {
  const conversion = detectAndConvertLegacy(code);
  const c = conversion.newCode;

  // Dot format without coordinates
  if (c.includes('.') && !c.includes('@')) {
    return {
      valid: false,
      error: 'Legacy dot format requires coordinates suffix: CC....@lat,lon'
    };
  }

  const parts = c.split('-');

  // Determine format type based on part count
  if (parts.length === 7) {
    // CC-MUN-COM-BAI-G10-X-Y (official format)
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
    const coordPattern = /^(N?[A-Z0-9]+)$/;
    if (!coordPattern.test(xpart) || !coordPattern.test(ypart)) {
      return { valid: false, error: 'Invalid coordinates: must be base36 with optional N prefix' };
    }
    
    return { 
      valid: true, 
      normalizedCode: c,
      wasConverted: conversion.converted,
      originalFormat: conversion.originalFormat,
      format: 'official',
      extractedAdmin: {
        municipalityCode: mun,
        communeCode: com,
        neighborhoodCode: bai
      }
    };
  } else if (parts.length === 6) {
    // CC-MUN-COM-G10-X-Y (partial format)
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
    const coordPattern = /^(N?[A-Z0-9]+)$/;
    if (!coordPattern.test(xpart) || !coordPattern.test(ypart)) {
      return { valid: false, error: 'Invalid coordinates' };
    }
    
    return { 
      valid: true, 
      normalizedCode: c,
      wasConverted: conversion.converted,
      format: 'partial',
      extractedAdmin: {
        municipalityCode: mun,
        communeCode: com
      }
    };
  } else if (parts.length === 5) {
    // CC-ZU-G10-X-Y (legacy) or CC-MUN-G10-X-Y (minimal)
    const [country, second, gpart, xpart, ypart] = parts;
    
    if (!/^[A-Z]{2}$/.test(country)) {
      return { valid: false, error: 'Invalid country code: must be 2 uppercase letters' };
    }
    
    // Check if second part is zone (ZU/ZR) or municipality code
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
    
    const coordPattern = /^(N?[A-Z0-9]+)$/;
    if (!coordPattern.test(xpart) || !coordPattern.test(ypart)) {
      return { valid: false, error: 'Invalid coordinates' };
    }
    
    return { 
      valid: true, 
      normalizedCode: c,
      wasConverted: conversion.converted,
      format: isZone ? 'legacy' : 'minimal',
      extractedAdmin: isZone ? undefined : { municipalityCode: second }
    };
  } else if (parts.length === 3 && /^[A-Z]{2}$/.test(parts[0])) {
    return {
      valid: false,
      error: 'Incomplete code: expected CC-MUN-COM-BAI-G10-X-Y or CC-ZU-G10-X-Y'
    };
  }
  
  return {
    valid: false,
    error: `Invalid format: expected 5-7 parts, got ${parts.length} parts`
  };
}

// --- Core: decode ---
function decodeAfroloc(code: string): DecodeResponse & { 
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
  
  // Extract parts based on format
  let country: string;
  let zone: 'urban' | 'rural';
  let grid_m: number;
  let ix: number;
  let iy: number;
  let municipalityCode: string | undefined;
  let communeCode: string | undefined;
  let neighborhoodCode: string | undefined;
  
  if (parts.length === 7) {
    // CC-MUN-COM-BAI-G10-X-Y
    country = parts[0];
    municipalityCode = parts[1];
    communeCode = parts[2];
    neighborhoodCode = parts[3];
    grid_m = parseInt(parts[4].slice(1), 10);
    ix = fromBase36(parts[5]);
    iy = fromBase36(parts[6]);
    zone = grid_m === 10 ? 'urban' : 'rural';
  } else if (parts.length === 6) {
    // CC-MUN-COM-G10-X-Y
    country = parts[0];
    municipalityCode = parts[1];
    communeCode = parts[2];
    grid_m = parseInt(parts[3].slice(1), 10);
    ix = fromBase36(parts[4]);
    iy = fromBase36(parts[5]);
    zone = grid_m === 10 ? 'urban' : 'rural';
  } else {
    // CC-ZU-G10-X-Y or CC-MUN-G10-X-Y
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
  
  // Generate legacy code for compatibility
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
    bbox: {
      minLon: sw.lon,
      minLat: sw.lat,
      maxLon: ne.lon,
      maxLat: ne.lat,
    },
    centroid: { lon: cent.lon, lat: cent.lat },
    wasConverted: validation.wasConverted,
    originalFormat: validation.originalFormat,
    format: validation.format,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Check if this is a validate-only request
    if (body.action === 'validate' && body.code) {
      console.log(`QG Engine: Validating ${body.code}`);
      const validation = validateAfrolocCode(body.code);
      
      console.log(`QG Engine: Validation result - valid: ${validation.valid}, format: ${validation.format}`);
      
      return new Response(
        JSON.stringify(validation),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if this is a decode request
    if (body.code && !body.latitude) {
      console.log(`QG Engine: Decoding ${body.code}`);
      const result = decodeAfroloc(body.code);
      
      if (result.wasConverted) {
        console.log(`QG Engine: Converted from ${result.originalFormat} format to ${result.afroloc}`);
      }
      console.log(`QG Engine: Decoded to centroid ${result.centroid.lat}, ${result.centroid.lon} (format: ${result.format})`);
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Encode request
    const request: QGRequest = body;
    
    // Validate input - GPS is mandatory
    if (request.latitude === undefined || request.longitude === undefined) {
      return new Response(
        JSON.stringify({ error: 'GPS coordinates are mandatory: latitude and longitude are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!request.countryCode) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: countryCode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate coordinates
    if (request.latitude < -90 || request.latitude > 90) {
      return new Response(
        JSON.stringify({ error: 'Invalid latitude: must be between -90 and 90' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (request.longitude < -180 || request.longitude > 180) {
      return new Response(
        JSON.stringify({ error: 'Invalid longitude: must be between -180 and 180' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const adminInfo = [
      request.municipalityCode,
      request.communeCode,
      request.neighborhoodCode
    ].filter(Boolean).join('/') || 'no-admin';
    
    console.log(`QG Engine: Encoding ${request.countryCode} @ ${request.latitude}, ${request.longitude} (admin: ${adminInfo})`);
    
    const result = encodeAfroloc(request);
    
    console.log(`QG Engine: Generated code ${result.afroloc} (${result.zone}, ${result.grid_m}m)`);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = (error as Error)?.message || 'Unknown error';
    console.error('QG Engine error:', error);

    const isClientError =
      message.startsWith('Invalid') ||
      message.startsWith('Incomplete') ||
      message.startsWith('Legacy') ||
      message.startsWith('GPS') ||
      message.startsWith('Missing') ||
      message.includes('must be');

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: isClientError ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
