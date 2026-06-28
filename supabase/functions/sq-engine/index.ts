import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/auth_rbac.ts";

/**
 * SQ ENGINE — ADAPTIVE SUBDIVISION v2
 * 
 * Dynamically subdivides QG cells based on real-time certification density.
 * Tracks density over time and promotes subdivision granularity as areas grow.
 * 
 * Subdivision tiers:
 *   - 2×2 (A-D)        → ≤10 certifications (low density)
 *   - 3×3 (1-9)         → ≤50 certifications (medium density)
 *   - 4×4 (A1-D4)       → ≤150 certifications (high density)
 *   - 5×5 (A1-E5)       → >150 certifications (very high density)
 * 
 * Features:
 *   - Density caching with temporal snapshots
 *   - Growth rate tracking for predictive promotion
 *   - Automatic cache refresh when stale (>24h)
 */

// ─── Types ───────────────────────────────────────────────────────

interface SQRequest {
  afroloc?: string;
  qgCode?: string;
  latitude: number;
  longitude: number;
  cellBounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  countryCode?: string;
  forceRecalculate?: boolean;
}

interface SQResponse {
  sqCode: string;
  fullCode: string;
  afroloc: string;
  subdivisionType: SubdivisionType;
  subCellIndex: string;
  subCellBounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  densityMetrics: {
    certificationCount: number;
    estimatedPopulation: number;
    densityClass: DensityClass;
    growthRatePercent: number;
    previousDensityClass: DensityClass | null;
    lastCalculatedAt: string;
    cacheHit: boolean;
  };
}

type DensityClass = 'low' | 'medium' | 'high' | 'very_high';
type SubdivisionType = '2x2' | '3x3' | '4x4' | '5x5';

// ─── Constants ───────────────────────────────────────────────────

const DENSITY_THRESHOLDS = { low: 10, medium: 50, high: 150 };
const CACHE_TTL_HOURS = 24;

const SQ_LABELS: Record<SubdivisionType, string[]> = {
  '2x2': ['A', 'B', 'C', 'D'],
  '3x3': ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  '4x4': [
    'A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4',
    'C1', 'C2', 'C3', 'C4', 'D1', 'D2', 'D3', 'D4',
  ],
  '5x5': [
    'A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'B3', 'B4', 'B5',
    'C1', 'C2', 'C3', 'C4', 'C5', 'D1', 'D2', 'D3', 'D4', 'D5',
    'E1', 'E2', 'E3', 'E4', 'E5',
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────

function classifyDensity(count: number): DensityClass {
  if (count <= DENSITY_THRESHOLDS.low) return 'low';
  if (count <= DENSITY_THRESHOLDS.medium) return 'medium';
  if (count <= DENSITY_THRESHOLDS.high) return 'high';
  return 'very_high';
}

function densityToSubdivision(d: DensityClass): SubdivisionType {
  switch (d) {
    case 'low': return '2x2';
    case 'medium': return '3x3';
    case 'high': return '4x4';
    case 'very_high': return '5x5';
  }
}

function subdivisionDim(t: SubdivisionType): number {
  return parseInt(t[0]);
}

function estimatePopulation(certCount: number, zone: 'urban' | 'rural'): number {
  const householdSize = 5;
  const coverageRate = zone === 'urban' ? 0.3 : 0.1;
  return Math.round((certCount * householdSize) / coverageRate);
}

function calculateGrowthRate(current: number, previous: number, days: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * (365 / days) * 10000) / 100;
}

// ─── AFROLOC Decode (local) ─────────────────────────────────────

function decodeAfrolocLocal(code: string): {
  country: string; zone: 'urban' | 'rural'; grid_m: number;
  tile_ix: number; tile_iy: number;
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
} {
  const c = detectAndConvertLegacy(code);
  const parts = c.split('-');
  if (parts.length !== 5) throw new Error(`Invalid AFROLOC: expected 5 parts, got ${parts.length}`);

  const [country, ztag, gpart, xpart, ypart] = parts;
  if (ztag !== 'ZU' && ztag !== 'ZR') throw new Error('Invalid zone tag');
  if (!gpart.startsWith('G')) throw new Error('Invalid grid part');

  const grid_m = parseInt(gpart.slice(1), 10);
  const parseCoord = (s: string) => s.startsWith('N') ? -parseInt(s.slice(1), 36) : parseInt(s, 36);
  const ix = parseCoord(xpart);
  const iy = parseCoord(ypart);

  const R = 6378137.0;
  const toLL = (x: number, y: number) => ({
    lon: (x / R) * (180 / Math.PI),
    lat: (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI),
  });

  const sw = toLL(ix * grid_m, iy * grid_m);
  const ne = toLL((ix + 1) * grid_m, (iy + 1) * grid_m);

  return {
    country, zone: ztag === 'ZU' ? 'urban' : 'rural', grid_m,
    tile_ix: ix, tile_iy: iy,
    bbox: { minLon: sw.lon, minLat: sw.lat, maxLon: ne.lon, maxLat: ne.lat },
  };
}

function detectAndConvertLegacy(code: string): string {
  let c = code.trim().toUpperCase();
  const parts = c.split('-');

  if (parts.length > 5) {
    const merged: string[] = [];
    let i = 0;
    while (i < parts.length) {
      if (parts[i] === '' && i + 1 < parts.length) { merged.push('N' + parts[i + 1]); i += 2; }
      else { merged.push(parts[i]); i++; }
    }
    if (merged.length === 5) return merged.join('-');
  }
  if (parts.length === 4) {
    const m = parts[3].match(/^X(-?\d+|N?\d+|[A-Z0-9]+)Y(-?\d+|N?\d+|[A-Z0-9]+)$/i);
    if (m) {
      let x = m[1], y = m[2];
      if (x.startsWith('-')) x = 'N' + x.slice(1);
      if (y.startsWith('-')) y = 'N' + y.slice(1);
      return `${parts[0]}-${parts[1]}-${parts[2]}-${x}-${y}`;
    }
  }
  if (parts.length === 5 && !parts[2].startsWith('G') && /^\d+$/.test(parts[2])) {
    parts[2] = 'G' + parts[2];
    return parts.join('-');
  }
  if (parts.length >= 3 && parts[1] === 'QG') { parts[1] = 'ZU'; return parts.join('-'); }
  if (parts.length === 5 && (parts[1] === 'U' || parts[1] === 'R')) {
    parts[1] = parts[1] === 'U' ? 'ZU' : 'ZR'; return parts.join('-');
  }
  return c;
}

// ─── Sub-Cell Computation ───────────────────────────────────────

function computeSubCellIndex(
  lat: number, lon: number,
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  dim: number
): number {
  const nLat = (lat - bbox.minLat) / (bbox.maxLat - bbox.minLat);
  const nLon = (lon - bbox.minLon) / (bbox.maxLon - bbox.minLon);
  const row = Math.max(0, Math.min(dim - 1, Math.floor((1 - nLat) * dim)));
  const col = Math.max(0, Math.min(dim - 1, Math.floor(nLon * dim)));
  return row * dim + col;
}

function computeSubCellBounds(
  parent: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  dim: number, idx: number
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

// ─── Density Cache ──────────────────────────────────────────────

interface CachedDensity {
  certificationCount: number;
  densityClass: DensityClass;
  subdivisionType: SubdivisionType;
  growthRatePercent: number;
  previousDensityClass: DensityClass | null;
  lastCalculatedAt: string;
}

async function getCachedDensity(
  supabase: any, afrolocCode: string
): Promise<CachedDensity | null> {
  const { data, error } = await supabase
    .from('cell_density_cache')
    .select('certification_count, density_class, subdivision_type, growth_rate_percent, previous_density_class, last_calculated_at')
    .eq('afroloc_code', afrolocCode)
    .maybeSingle();

  if (error || !data) return null;

  // Check if cache is stale
  const age = Date.now() - new Date(data.last_calculated_at).getTime();
  if (age > CACHE_TTL_HOURS * 60 * 60 * 1000) return null;

  return {
    certificationCount: data.certification_count,
    densityClass: data.density_class as DensityClass,
    subdivisionType: data.subdivision_type as SubdivisionType,
    growthRatePercent: data.growth_rate_percent || 0,
    previousDensityClass: data.previous_density_class as DensityClass | null,
    lastCalculatedAt: data.last_calculated_at,
  };
}

async function updateDensityCache(
  supabase: any,
  afrolocCode: string,
  decoded: { country: string; zone: 'urban' | 'rural'; grid_m: number; tile_ix: number; tile_iy: number; bbox: any },
  certCount: number,
  densityClass: DensityClass,
  subdivisionType: SubdivisionType
): Promise<{ growthRate: number; previousClass: DensityClass | null }> {
  // Get previous cache entry for growth calculation
  const { data: prev } = await supabase
    .from('cell_density_cache')
    .select('certification_count, density_class, last_calculated_at')
    .eq('afroloc_code', afrolocCode)
    .maybeSingle();

  let growthRate = 0;
  let previousClass: DensityClass | null = null;

  if (prev) {
    const daysBetween = Math.max(1, (Date.now() - new Date(prev.last_calculated_at).getTime()) / (1000 * 60 * 60 * 24));
    growthRate = calculateGrowthRate(certCount, prev.certification_count, daysBetween);
    previousClass = prev.density_class as DensityClass;
  }

  const estimatedPop = estimatePopulation(certCount, decoded.zone);

  // Upsert cache
  await supabase.from('cell_density_cache').upsert({
    afroloc_code: afrolocCode,
    country_code: decoded.country,
    zone: decoded.zone,
    grid_m: decoded.grid_m,
    tile_ix: decoded.tile_ix,
    tile_iy: decoded.tile_iy,
    certification_count: certCount,
    estimated_population: estimatedPop,
    density_class: densityClass,
    subdivision_type: subdivisionType,
    last_calculated_at: new Date().toISOString(),
    growth_rate_percent: growthRate,
    previous_density_class: previousClass,
    promoted_at: previousClass && previousClass !== densityClass ? new Date().toISOString() : null,
    bbox_min_lat: decoded.bbox.minLat,
    bbox_min_lon: decoded.bbox.minLon,
    bbox_max_lat: decoded.bbox.maxLat,
    bbox_max_lon: decoded.bbox.maxLon,
  }, { onConflict: 'afroloc_code' });

  // Record history snapshot
  await supabase.from('cell_density_history').insert({
    afroloc_code: afrolocCode,
    certification_count: certCount,
    density_class: densityClass,
    subdivision_type: subdivisionType,
    growth_rate_percent: growthRate,
  });

  return { growthRate, previousClass };
}

// ─── Live Certification Count ───────────────────────────────────

async function getLiveCertCount(
  supabase: any,
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('afroloc_records')
      .select('*', { count: 'exact', head: true })
      .gte('geo_lat', bbox.minLat)
      .lte('geo_lat', bbox.maxLat)
      .gte('geo_lon', bbox.minLon)
      .lte('geo_lon', bbox.maxLon);
    if (error) { console.error('Cert count error:', error); return 0; }
    return count || 0;
  } catch { return 0; }
}

// ─── Main SQ Computation ────────────────────────────────────────

async function computeSQ(request: SQRequest, supabase: any): Promise<SQResponse> {
  const { latitude, longitude } = request;

  // Decode parent cell
  let afrolocCode: string;
  let cellBounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  let decoded: ReturnType<typeof decodeAfrolocLocal>;

  if (request.afroloc) {
    decoded = decodeAfrolocLocal(request.afroloc);
    afrolocCode = detectAndConvertLegacy(request.afroloc);
    cellBounds = decoded.bbox;
  } else if (request.qgCode && request.cellBounds) {
    afrolocCode = detectAndConvertLegacy(request.qgCode);
    decoded = decodeAfrolocLocal(afrolocCode);
    cellBounds = request.cellBounds;
  } else {
    throw new Error('Either afroloc or (qgCode + cellBounds) must be provided');
  }

  // Try cache first
  let certCount: number;
  let densityClass: DensityClass;
  let subdivType: SubdivisionType;
  let growthRate = 0;
  let previousClass: DensityClass | null = null;
  let cacheHit = false;
  let lastCalcAt = new Date().toISOString();

  const cached = request.forceRecalculate ? null : await getCachedDensity(supabase, afrolocCode);

  if (cached) {
    certCount = cached.certificationCount;
    densityClass = cached.densityClass;
    subdivType = cached.subdivisionType;
    growthRate = cached.growthRatePercent;
    previousClass = cached.previousDensityClass;
    lastCalcAt = cached.lastCalculatedAt;
    cacheHit = true;
  } else {
    // Live calculation
    certCount = await getLiveCertCount(supabase, cellBounds);
    densityClass = classifyDensity(certCount);
    subdivType = densityToSubdivision(densityClass);

    // Update cache & history
    const cacheResult = await updateDensityCache(supabase, afrolocCode, decoded, certCount, densityClass, subdivType);
    growthRate = cacheResult.growthRate;
    previousClass = cacheResult.previousClass;
  }

  // Compute sub-cell
  const dim = subdivisionDim(subdivType);
  const idx = computeSubCellIndex(latitude, longitude, cellBounds, dim);
  const labels = SQ_LABELS[subdivType];
  const subCellLabel = labels[idx] || '?';
  const subBounds = computeSubCellBounds(cellBounds, dim, idx);

  const sqCode = `SQ${dim}${dim}-${subCellLabel}`;
  const fullCode = `${afrolocCode}-${sqCode}`;

  console.log(`SQ Engine v2: ${fullCode} | density=${densityClass} (${certCount} certs) | cache=${cacheHit} | growth=${growthRate}%`);

  return {
    sqCode,
    fullCode,
    afroloc: afrolocCode,
    subdivisionType: subdivType,
    subCellIndex: subCellLabel,
    subCellBounds: subBounds,
    densityMetrics: {
      certificationCount: certCount,
      estimatedPopulation: estimatePopulation(certCount, decoded.zone),
      densityClass,
      growthRatePercent: growthRate,
      previousDensityClass: previousClass,
      lastCalculatedAt: lastCalcAt,
      cacheHit,
    },
  };
}

// ─── HTTP Handler ───────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const request: SQRequest = await req.json();

    if (!request.latitude || !request.longitude) {
      return new Response(
        JSON.stringify({ error: 'Missing required: latitude, longitude' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!request.afroloc && !request.qgCode) {
      return new Response(
        JSON.stringify({ error: 'Either afroloc or qgCode required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await computeSQ(request, supabase);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('SQ Engine error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
