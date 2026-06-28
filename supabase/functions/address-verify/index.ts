import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/auth_rbac.ts";

/**
 * POST /address/verify
 * 
 * Formal REST endpoint for verifying an AFROLOC address.
 * Compliant with AFROLOC Handbook Chapter 12 specifications.
 * 
 * Request Body:
 * {
 *   "afrolocCode": string,        // Required: AFROLOC code to verify
 *   "currentLatitude": number,    // Required: Current GPS latitude
 *   "currentLongitude": number,   // Required: Current GPS longitude
 *   "witnessIds": string[]        // Optional: Array of witness user IDs
 * }
 * 
 * Response:
 * {
 *   "success": boolean,
 *   "data": {
 *     "verified": boolean,
 *     "distanceMeters": number,
 *     "threshold": number,
 *     "record": {...},
 *     "atsScore": number,
 *     "certificationLevel": number,
 *     "witnesses": {...}
 *   },
 *   "error": string | null,
 *   "requestId": string,
 *   "timestamp": string
 * }
 */

interface AddressVerifyRequest {
  afrolocCode: string;
  currentLatitude: number;
  currentLongitude: number;
  witnessIds?: string[];
}

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  requestId: string;
  timestamp: string;
}

function generateRequestId(): string {
  return `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

function validateRequest(body: any): { valid: boolean; error?: string } {
  if (!body.afrolocCode || typeof body.afrolocCode !== 'string') {
    return { valid: false, error: 'afrolocCode is required and must be a string' };
  }
  if (body.currentLatitude === undefined || typeof body.currentLatitude !== 'number') {
    return { valid: false, error: 'currentLatitude is required and must be a number' };
  }
  if (body.currentLongitude === undefined || typeof body.currentLongitude !== 'number') {
    return { valid: false, error: 'currentLongitude is required and must be a number' };
  }
  if (body.currentLatitude < -90 || body.currentLatitude > 90) {
    return { valid: false, error: 'currentLatitude must be between -90 and 90' };
  }
  if (body.currentLongitude < -180 || body.currentLongitude > 180) {
    return { valid: false, error: 'currentLongitude must be between -180 and 180' };
  }
  return { valid: true };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
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
    const response: ApiResponse = {
      success: false,
      error: 'Method not allowed. Use POST.',
      requestId,
      timestamp,
    };
    return new Response(JSON.stringify(response), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get authorization token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      const response: ApiResponse = {
        success: false,
        error: 'Authorization header is required',
        requestId,
        timestamp,
      };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid or expired token',
        requestId,
        timestamp,
      };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate request body
    const body: AddressVerifyRequest = await req.json();
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      const response: ApiResponse = {
        success: false,
        error: validation.error,
        requestId,
        timestamp,
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${requestId}] Verifying address ${body.afrolocCode}`);

    // Lookup the record
    const { data: record, error: recordError } = await supabase
      .from('afroloc_records')
      .select('*')
      .eq('code', body.afrolocCode)
      .single();
    
    if (recordError || !record) {
      const response: ApiResponse = {
        success: false,
        error: 'Address not found',
        requestId,
        timestamp,
      };
      return new Response(JSON.stringify(response), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate distance from stored coordinates
    const distanceMeters = calculateDistance(
      record.geo_lat,
      record.geo_lon,
      body.currentLatitude,
      body.currentLongitude
    );

    // Verification threshold (100m for urban, 500m for rural)
    const isUrban = record.metadata?.cellType === 'urban';
    const threshold = isUrban ? 100 : 500;
    const isLocationMatch = distanceMeters <= threshold;

    // Get witnesses info
    const { data: witnesses } = await supabase
      .from('afroloc_witnesses')
      .select('id, witness_user_id, witness_afro_id, status, confirmed_at, validated_at, witness_reputation_score')
      .eq('afroloc_record_id', record.id);

    const witnessStats = {
      total: witnesses?.length || 0,
      pending: witnesses?.filter(w => w.status === 'pending').length || 0,
      confirmed: witnesses?.filter(w => w.status === 'confirmed').length || 0,
      rejected: witnesses?.filter(w => w.status === 'rejected').length || 0,
      validated: witnesses?.filter(w => w.validated_at !== null).length || 0,
      averageReputation: witnesses && witnesses.length > 0
        ? witnesses.reduce((sum, w) => sum + (w.witness_reputation_score || 50), 0) / witnesses.length
        : 0,
    };

    // Get current ATS score
    const atsResult = await callATSEngine(record.id);
    console.log(`[${requestId}] Verification: distance=${distanceMeters.toFixed(2)}m, threshold=${threshold}m, match=${isLocationMatch}`);

    // Update last verified if match
    if (isLocationMatch) {
      await supabase
        .from('afroloc_records')
        .update({ last_verified_at: new Date().toISOString() })
        .eq('id', record.id);
    }

    // Log audit
    await supabase.from('security_audit_log').insert({
      user_id: user.id,
      action: 'address_verify',
      function_name: 'address-verify',
      details: {
        requestId,
        afrolocCode: body.afrolocCode,
        verified: isLocationMatch,
        distanceMeters,
        threshold,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: {
        verified: isLocationMatch,
        distanceMeters: Math.round(distanceMeters * 100) / 100,
        threshold,
        cellType: isUrban ? 'urban' : 'rural',
        record: {
          code: record.code,
          country: record.country,
          status: record.status,
          addressType: record.address_type,
          level1Name: record.level1_name,
          level2Name: record.level2_name,
          level3Name: record.level3_name,
          level4Name: record.level4_name,
          streetName: record.street_name,
          number: record.number,
          createdAt: record.created_at,
          lastVerifiedAt: record.last_verified_at,
        },
        coordinates: {
          stored: { lat: record.geo_lat, lon: record.geo_lon },
          provided: { lat: body.currentLatitude, lon: body.currentLongitude },
        },
        witnesses: witnessStats,
        atsScore: atsResult.score.total,
        atsBreakdown: atsResult.score,
        certificationLevel: atsResult.certificationLevel.level,
        certificationName: atsResult.certificationLevel.name,
        validationFlags: atsResult.validationFlags,
        recommendations: atsResult.recommendations,
      },
      requestId,
      timestamp,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error(`[${requestId}] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    const response: ApiResponse = {
      success: false,
      error: errorMessage,
      requestId,
      timestamp,
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
