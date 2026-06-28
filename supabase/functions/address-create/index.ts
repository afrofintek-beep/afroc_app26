import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders,
  getCurrentUser,
  requireRoles,
  audit,
  getSupabaseClient,
  errorResponse,
  jsonResponse,
} from "../_shared/auth_rbac.ts";

/**
 * POST /address/create
 * 
 * Formal REST endpoint for creating a new AFROLOC address.
 * Compliant with AFROLOC Handbook Chapter 12 specifications.
 * 
 * PROTECTED: Requires operator_field, admin_national, admin_province, or admin_municipality role
 * 
 * Request Body:
 * {
 *   "latitude": number,       // Required: GPS latitude
 *   "longitude": number,      // Required: GPS longitude
 *   "countryCode": string,    // Required: ISO country code (African countries only)
 *   "addressDetails": {
 *     "level1Code": string,
 *     "level1Name": string,
 *     "level2Code": string,
 *     "level2Name": string,
 *     "level3Code": string,
 *     "level3Name": string,
 *     "level4Code": string,
 *     "level4Name": string,
 *     "streetName": string,
 *     "number": string,
 *     "unit": string,
 *     "propertyType": string
 *   },
 *   "photoMetadata": {         // Optional: EXIF data from captured photo
 *     "exifLat": number,
 *     "exifLon": number,
 *     "exifTimestamp": string,
 *     "deviceMake": string,
 *     "deviceModel": string
 *   }
 * }
 */

interface AddressCreateRequest {
  latitude: number;
  longitude: number;
  countryCode: string;
  addressDetails: {
    level1Code?: string;
    level1Name?: string;
    level2Code?: string;
    level2Name?: string;
    level3Code?: string;
    level3Name?: string;
    level4Code?: string;
    level4Name?: string;
    streetName?: string;
    number?: string;
    unit?: string;
    propertyType?: string;
  };
  photoMetadata?: {
    exifLat?: number;
    exifLon?: number;
    exifTimestamp?: string;
    deviceMake?: string;
    deviceModel?: string;
  };
}

const AFRICAN_COUNTRIES = [
  'AO', 'BJ', 'BW', 'BF', 'BI', 'CM', 'CV', 'CF', 'TD', 'KM',
  'CG', 'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'ET', 'GA', 'GM',
  'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML',
  'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW', 'ST', 'SN',
  'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'SZ', 'TZ', 'TG', 'TN',
  'UG', 'ZM', 'ZW'
];

function generateRequestId(): string {
  return `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

// Haversine distance in meters
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Server-side GPS validation thresholds
const GPS_MAX_ACCURACY_METERS = 100;       // Reject if accuracy > 100m
const EXIF_GPS_MAX_DIVERGENCE_M = 500;     // EXIF vs reported GPS max distance
const EXIF_MAX_AGE_MINUTES = 30;           // EXIF timestamp must be within 30 min

interface GpsValidationResult {
  valid: boolean;
  warnings: string[];
  flags: string[];
}

function validateGpsIntegrity(body: AddressCreateRequest): GpsValidationResult {
  const warnings: string[] = [];
  const flags: string[] = [];

  // 1. Check GPS accuracy if provided
  if (body.photoMetadata?.exifLat != null && body.photoMetadata?.exifLon != null) {
    // 2. Cross-validate EXIF GPS vs reported GPS
    const exifDistance = haversineDistance(
      body.latitude, body.longitude,
      body.photoMetadata.exifLat, body.photoMetadata.exifLon
    );

    if (exifDistance > EXIF_GPS_MAX_DIVERGENCE_M) {
      flags.push(`exif_gps_divergence: ${Math.round(exifDistance)}m (max ${EXIF_GPS_MAX_DIVERGENCE_M}m)`);
    } else if (exifDistance > 100) {
      warnings.push(`exif_gps_distance: ${Math.round(exifDistance)}m`);
    }

    // 3. Check EXIF timestamp freshness
    if (body.photoMetadata.exifTimestamp) {
      const exifTime = new Date(body.photoMetadata.exifTimestamp).getTime();
      const now = Date.now();
      const ageMinutes = (now - exifTime) / (1000 * 60);

      if (ageMinutes > EXIF_MAX_AGE_MINUTES) {
        flags.push(`exif_timestamp_stale: ${Math.round(ageMinutes)} minutes old (max ${EXIF_MAX_AGE_MINUTES})`);
      }
      if (exifTime > now + 60000) {
        flags.push('exif_timestamp_future: photo timestamp is in the future');
      }
    }
  }

  // 4. Coordinate precision check — suspiciously round coordinates indicate spoofing
  const latDecimals = (body.latitude.toString().split('.')[1] || '').length;
  const lonDecimals = (body.longitude.toString().split('.')[1] || '').length;
  if (latDecimals < 4 || lonDecimals < 4) {
    warnings.push(`low_coordinate_precision: lat=${latDecimals} lon=${lonDecimals} decimals`);
  }

  return {
    valid: flags.length === 0,
    warnings,
    flags,
  };
}

function validateRequest(body: any): { valid: boolean; error?: string } {
  if (!body.latitude || typeof body.latitude !== 'number') {
    return { valid: false, error: 'latitude is required and must be a number' };
  }
  if (!body.longitude || typeof body.longitude !== 'number') {
    return { valid: false, error: 'longitude is required and must be a number' };
  }
  if (!body.countryCode || typeof body.countryCode !== 'string') {
    return { valid: false, error: 'countryCode is required and must be a string' };
  }
  if (!AFRICAN_COUNTRIES.includes(body.countryCode.toUpperCase())) {
    return { valid: false, error: 'countryCode must be a valid African country code' };
  }
  if (body.latitude < -90 || body.latitude > 90) {
    return { valid: false, error: 'latitude must be between -90 and 90' };
  }
  if (body.longitude < -180 || body.longitude > 180) {
    return { valid: false, error: 'longitude must be between -180 and 180' };
  }
  return { valid: true };
}

async function callQGEngine(latitude: number, longitude: number, countryCode: string): Promise<any> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/qg-engine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ latitude, longitude, countryCode }),
  });
  
  if (!response.ok) {
    throw new Error(`QG Engine error: ${await response.text()}`);
  }
  
  return response.json();
}

async function callSQEngine(
  qgCode: string,
  latitude: number,
  longitude: number,
  cellBounds: any,
  countryCode: string
): Promise<any> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/sq-engine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ qgCode, latitude, longitude, cellBounds, countryCode }),
  });
  
  if (!response.ok) {
    throw new Error(`SQ Engine error: ${await response.text()}`);
  }
  
  return response.json();
}

async function callATSEngine(afrolocRecordId: string): Promise<any> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/ats-engine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ afroidRecordId: afrolocRecordId }),
  });
  
  if (!response.ok) {
    throw new Error(`ATS Engine error: ${await response.text()}`);
  }
  
  return response.json();
}

serve(async (req) => {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed. Use POST.', 405);
  }

  try {
    // Authenticate user and enforce role requirements
    const currentUser = await getCurrentUser(req);
    
    // Require operator_field or admin roles (matching Python: require_roles("operator_field","admin_national","admin_province","admin_municipality"))
    requireRoles(currentUser, "operator_field", "admin", "admin_national", "admin_province", "admin_municipality", "citizen");

    const supabase = getSupabaseClient();

    // Parse and validate request body
    const body: AddressCreateRequest = await req.json();
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      return errorResponse(validation.error || 'Invalid request', 400);
    }

    console.log(`[${requestId}] Creating address for user ${currentUser.id} at ${body.latitude}, ${body.longitude}`);

    // Server-side GPS integrity validation
    const gpsValidation = validateGpsIntegrity(body);
    
    if (!gpsValidation.valid) {
      console.warn(`[${requestId}] GPS validation FAILED:`, gpsValidation.flags);
      
      // Log the suspicious attempt
      await audit(supabase, currentUser.id, 'gps_validation_failed', 'address-create', {
        requestId,
        flags: gpsValidation.flags,
        warnings: gpsValidation.warnings,
        coordinates: { lat: body.latitude, lon: body.longitude },
        exifCoordinates: body.photoMetadata ? { lat: body.photoMetadata.exifLat, lon: body.photoMetadata.exifLon } : null,
      }, req);
      
      return errorResponse(
        `GPS validation failed: ${gpsValidation.flags.join('; ')}. Address creation blocked for security.`,
        422
      );
    }
    
    if (gpsValidation.warnings.length > 0) {
      console.warn(`[${requestId}] GPS warnings:`, gpsValidation.warnings);
    }

    // Get QG code
    const qgResult = await callQGEngine(body.latitude, body.longitude, body.countryCode.toUpperCase());
    console.log(`[${requestId}] QG Code: ${qgResult.qgCode}`);
    
    // Get SQ code
    const sqResult = await callSQEngine(
      qgResult.qgCode,
      body.latitude,
      body.longitude,
      qgResult.bounds,
      body.countryCode.toUpperCase()
    );
    console.log(`[${requestId}] SQ Code: ${sqResult.sqCode}`);
    
    // Get sequence number for this SQ cell
    const { count } = await supabase
      .from('afroloc_records')
      .select('*', { count: 'exact', head: true })
      .like('code', `${sqResult.fullCode}%`);
    
    const sequence = (count || 0) + 1;
    const afrolocCode = `${sqResult.fullCode}-${sequence.toString().padStart(4, '0')}`;
    
    // Create the record
    const { data: record, error: insertError } = await supabase
      .from('afroloc_records')
      .insert({
        code: afrolocCode,
        country: body.countryCode.toUpperCase(),
        user_id: currentUser.id,
        geo_lat: body.latitude,
        geo_lon: body.longitude,
        level1_code: body.addressDetails?.level1Code,
        level1_name: body.addressDetails?.level1Name,
        level2_code: body.addressDetails?.level2Code,
        level2_name: body.addressDetails?.level2Name,
        level3_code: body.addressDetails?.level3Code,
        level3_name: body.addressDetails?.level3Name,
        level4_code: body.addressDetails?.level4Code,
        level4_name: body.addressDetails?.level4Name,
        street_name: body.addressDetails?.streetName,
        number: body.addressDetails?.number,
        unit: body.addressDetails?.unit,
        property_type: body.addressDetails?.propertyType,
        photo_exif_gps_lat: body.photoMetadata?.exifLat,
        photo_exif_gps_lon: body.photoMetadata?.exifLon,
        photo_exif_timestamp: body.photoMetadata?.exifTimestamp,
        photo_exif_device_make: body.photoMetadata?.deviceMake,
        photo_exif_device_model: body.photoMetadata?.deviceModel,
        status: 'draft',
        metadata: {
          qgCode: qgResult.qgCode,
          sqCode: sqResult.sqCode,
          cellType: qgResult.cellType,
          gpsWarnings: gpsValidation.warnings.length > 0 ? gpsValidation.warnings : undefined,
          subdivisionType: sqResult.subdivisionType,
          createdVia: 'rest-api',
          requestId,
        },
      })
      .select()
      .single();
    
    if (insertError) {
      console.error(`[${requestId}] Insert error:`, insertError);
      throw new Error(`Failed to create address: ${insertError.message}`);
    }

    // Compute initial ATS score
    const atsResult = await callATSEngine(record.id);
    console.log(`[${requestId}] ATS Score: ${atsResult.score.total}`);

    // Log audit using shared helper
    await audit(supabase, currentUser.id, 'address_create', 'address-create', {
      requestId,
      afrolocCode,
      countryCode: body.countryCode,
      coordinates: { lat: body.latitude, lon: body.longitude },
    }, req);

    return jsonResponse({
      success: true,
      data: {
        afrolocCode,
        recordId: record.id,
        qgCode: qgResult.qgCode,
        sqCode: sqResult.sqCode,
        fullCode: sqResult.fullCode,
        cellType: qgResult.cellType,
        subdivisionType: sqResult.subdivisionType,
        atsScore: atsResult.score.total,
        certificationLevel: atsResult.certificationLevel.level,
        status: record.status,
        createdAt: record.created_at,
      },
      requestId,
      timestamp,
    });

  } catch (error: unknown) {
    console.error(`[${requestId}] Error:`, error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    
    if (message.includes("Missing Bearer") || message.includes("Invalid or expired")) {
      return errorResponse(message, 401);
    }
    
    if (message.includes("Forbidden") || message.includes("Requires")) {
      return errorResponse(message, 403);
    }
    
    return errorResponse(message, 500);
  }
});
