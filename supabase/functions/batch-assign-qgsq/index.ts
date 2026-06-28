import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/auth_rbac.ts";

/**
 * BATCH ASSIGN QG/SQ CODES
 * 
 * Processes afroloc_records missing geospatial codes and assigns
 * QG (Quadrant Grid) and SQ (Sub-Quadrant) codes based on GPS coordinates.
 */

interface BatchRequest {
  countryCode?: string;
  limit?: number;
  dryRun?: boolean;
}

interface ProcessedRecord {
  id: string;
  code: string;
  qgCode: string;
  sqCode: string;
  fullCode: string;
  success: boolean;
  error?: string;
}

interface BatchResponse {
  totalFound: number;
  processed: number;
  successful: number;
  failed: number;
  dryRun: boolean;
  records: ProcessedRecord[];
  errors: string[];
}

// ===== QG ENGINE LOGIC (embedded to avoid function calls) =====

const EARTH_RADIUS = 6378137;
const MAX_MERCATOR = Math.PI * EARTH_RADIUS;
const URBAN_CELL_SIZE = 150;
const RURAL_CELL_SIZE = 500;

function lonToMercatorX(lon: number): number {
  return (lon * MAX_MERCATOR) / 180;
}

function latToMercatorY(lat: number): number {
  const latRad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + latRad / 2)) * EARTH_RADIUS;
}

function mercatorXToLon(x: number): number {
  return (x * 180) / MAX_MERCATOR;
}

function mercatorYToLat(y: number): number {
  const latRad = 2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2;
  return (latRad * 180) / Math.PI;
}

function determineAreaType(lat: number, lon: number, countryCode: string): 'urban' | 'rural' {
  const urbanCenters: Record<string, Array<{ lat: number; lon: number; radius: number }>> = {
    'AO': [
      { lat: -8.839, lon: 13.289, radius: 0.3 },
      { lat: -12.575, lon: 13.405, radius: 0.1 },
      { lat: -12.345, lon: 16.876, radius: 0.1 },
    ],
    'ZA': [
      { lat: -26.204, lon: 28.045, radius: 0.4 },
      { lat: -33.925, lon: 18.424, radius: 0.3 },
      { lat: -29.858, lon: 31.029, radius: 0.2 },
    ],
    'KE': [
      { lat: -1.286, lon: 36.817, radius: 0.3 },
      { lat: -4.043, lon: 39.668, radius: 0.15 },
    ],
    'NG': [
      { lat: 6.524, lon: 3.379, radius: 0.4 },
      { lat: 9.057, lon: 7.495, radius: 0.2 },
    ],
    'MZ': [
      { lat: -25.966, lon: 32.585, radius: 0.15 },
    ],
  };

  const centers = urbanCenters[countryCode] || [];
  
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

function generateQGCode(
  countryCode: string,
  cellX: number,
  cellY: number,
  cellType: 'urban' | 'rural'
): string {
  const offsetX = cellX + 1000000;
  const offsetY = cellY + 1000000;
  
  const xCode = offsetX.toString(36).toUpperCase().padStart(5, '0');
  const yCode = offsetY.toString(36).toUpperCase().padStart(5, '0');
  
  const typeCode = cellType === 'urban' ? 'U' : 'R';
  
  return `${countryCode}-QG-${typeCode}${xCode}${yCode}`;
}

function calculateCellBounds(cellX: number, cellY: number, cellSize: number) {
  const minX = cellX * cellSize;
  const maxX = (cellX + 1) * cellSize;
  const minY = cellY * cellSize;
  const maxY = (cellY + 1) * cellSize;
  
  return {
    minLon: mercatorXToLon(minX),
    maxLon: mercatorXToLon(maxX),
    minLat: mercatorYToLat(minY),
    maxLat: mercatorYToLat(maxY),
  };
}

function computeQG(latitude: number, longitude: number, countryCode: string) {
  const mercatorX = lonToMercatorX(longitude);
  const mercatorY = latToMercatorY(latitude);
  
  const cellType = determineAreaType(latitude, longitude, countryCode);
  const cellSize = cellType === 'urban' ? URBAN_CELL_SIZE : RURAL_CELL_SIZE;
  
  const cellX = Math.floor(mercatorX / cellSize);
  const cellY = Math.floor(mercatorY / cellSize);
  
  const qgCode = generateQGCode(countryCode, cellX, cellY, cellType);
  const bounds = calculateCellBounds(cellX, cellY, cellSize);
  
  return {
    qgCode,
    cellX,
    cellY,
    cellSize,
    cellType,
    bounds,
  };
}

// ===== SQ ENGINE LOGIC (embedded) =====

const SUBDIVISION_2X2 = ['A', 'B', 'C', 'D'];
const SUBDIVISION_3X3 = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const SUBDIVISION_4X4 = [
  'A1', 'A2', 'A3', 'A4',
  'B1', 'B2', 'B3', 'B4',
  'C1', 'C2', 'C3', 'C4',
  'D1', 'D2', 'D3', 'D4'
];

const LOW_DENSITY_THRESHOLD = 10;
const MEDIUM_DENSITY_THRESHOLD = 50;

function calculateSubCellIndex(
  lat: number,
  lon: number,
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  gridSize: number
): number {
  const latRange = bounds.maxLat - bounds.minLat;
  const lonRange = bounds.maxLon - bounds.minLon;
  
  const normalizedLat = (lat - bounds.minLat) / latRange;
  const normalizedLon = (lon - bounds.minLon) / lonRange;
  
  const row = Math.floor((1 - normalizedLat) * gridSize);
  const col = Math.floor(normalizedLon * gridSize);
  
  const clampedRow = Math.max(0, Math.min(gridSize - 1, row));
  const clampedCol = Math.max(0, Math.min(gridSize - 1, col));
  
  return clampedRow * gridSize + clampedCol;
}

async function getCertificationCount(
  supabase: any,
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('afroloc_records')
      .select('*', { count: 'exact', head: true })
      .gte('geo_lat', bounds.minLat)
      .lte('geo_lat', bounds.maxLat)
      .gte('geo_lon', bounds.minLon)
      .lte('geo_lon', bounds.maxLon);
    
    if (error) {
      console.error('Error fetching certification count:', error);
      return 0;
    }
    
    return count || 0;
  } catch (err) {
    console.error('Exception in getCertificationCount:', err);
    return 0;
  }
}

function determineSubdivisionType(certCount: number): '2x2' | '3x3' | '4x4' {
  if (certCount <= LOW_DENSITY_THRESHOLD) {
    return '2x2';
  } else if (certCount <= MEDIUM_DENSITY_THRESHOLD) {
    return '3x3';
  } else {
    return '4x4';
  }
}

async function computeSQ(
  qgCode: string,
  latitude: number,
  longitude: number,
  cellBounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  supabase: any
) {
  const certCount = await getCertificationCount(supabase, cellBounds);
  const subdivisionType = determineSubdivisionType(certCount);
  
  const gridSize = subdivisionType === '2x2' ? 2 : subdivisionType === '3x3' ? 3 : 4;
  const subCellIndexNum = calculateSubCellIndex(latitude, longitude, cellBounds, gridSize);
  
  let subCellIndex: string;
  if (subdivisionType === '2x2') {
    subCellIndex = SUBDIVISION_2X2[subCellIndexNum];
  } else if (subdivisionType === '3x3') {
    subCellIndex = SUBDIVISION_3X3[subCellIndexNum];
  } else {
    subCellIndex = SUBDIVISION_4X4[subCellIndexNum];
  }
  
  const sqCode = `SQ-${subCellIndex}`;
  const fullCode = `${qgCode}-${sqCode}`;
  
  return {
    sqCode,
    fullCode,
    subdivisionType,
    subCellIndex,
  };
}

// ===== MAIN BATCH PROCESSING =====

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const request: BatchRequest = await req.json();
    const { countryCode, limit = 100, dryRun = false } = request;
    
    console.log(`Batch QG/SQ: Starting batch process (countryCode=${countryCode || 'all'}, limit=${limit}, dryRun=${dryRun})`);
    
    // Build query for records with GPS but missing geospatial metadata
    let query = supabase
      .from('afroloc_records')
      .select('id, code, country, geo_lat, geo_lon, metadata')
      .not('geo_lat', 'is', null)
      .not('geo_lon', 'is', null)
      .limit(limit);
    
    if (countryCode) {
      query = query.eq('country', countryCode);
    }
    
    const { data: records, error: fetchError } = await query;
    
    if (fetchError) {
      console.error('Error fetching records:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch records', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Filter records that don't have QG/SQ codes in metadata
    const recordsToProcess = (records || []).filter(record => {
      const metadata = record.metadata || {};
      return !metadata.qgCode || !metadata.sqCode;
    });
    
    console.log(`Batch QG/SQ: Found ${recordsToProcess.length} records to process out of ${records?.length || 0} total`);
    
    const response: BatchResponse = {
      totalFound: recordsToProcess.length,
      processed: 0,
      successful: 0,
      failed: 0,
      dryRun,
      records: [],
      errors: [],
    };
    
    // Process each record
    for (const record of recordsToProcess) {
      try {
        const lat = Number(record.geo_lat);
        const lon = Number(record.geo_lon);
        const country = record.country;
        
        // Compute QG
        const qgResult = computeQG(lat, lon, country);
        
        // Compute SQ
        const sqResult = await computeSQ(
          qgResult.qgCode,
          lat,
          lon,
          qgResult.bounds,
          supabase
        );
        
        const processedRecord: ProcessedRecord = {
          id: record.id,
          code: record.code,
          qgCode: qgResult.qgCode,
          sqCode: sqResult.sqCode,
          fullCode: sqResult.fullCode,
          success: true,
        };
        
        // Update record if not dry run
        if (!dryRun) {
          const existingMetadata = record.metadata || {};
          const updatedMetadata = {
            ...existingMetadata,
            qgCode: qgResult.qgCode,
            sqCode: sqResult.sqCode,
            fullGridCode: sqResult.fullCode,
            gridCellType: qgResult.cellType,
            gridCellSize: qgResult.cellSize,
            sqSubdivision: sqResult.subdivisionType,
            gridAssignedAt: new Date().toISOString(),
          };
          
          const { error: updateError } = await supabase
            .from('afroloc_records')
            .update({ metadata: updatedMetadata })
            .eq('id', record.id);
          
          if (updateError) {
            processedRecord.success = false;
            processedRecord.error = updateError.message;
            response.failed++;
            response.errors.push(`Record ${record.code}: ${updateError.message}`);
          } else {
            response.successful++;
          }
        } else {
          response.successful++;
        }
        
        response.records.push(processedRecord);
        response.processed++;
        
        console.log(`Batch QG/SQ: Processed ${record.code} -> ${sqResult.fullCode}`);
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        response.failed++;
        response.errors.push(`Record ${record.code}: ${errorMessage}`);
        response.records.push({
          id: record.id,
          code: record.code,
          qgCode: '',
          sqCode: '',
          fullCode: '',
          success: false,
          error: errorMessage,
        });
        response.processed++;
      }
    }
    
    console.log(`Batch QG/SQ: Complete. Processed=${response.processed}, Success=${response.successful}, Failed=${response.failed}`);
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error('Batch QG/SQ error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
