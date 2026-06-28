import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/auth_rbac.ts";

/**
 * POST /ats/score
 * 
 * Formal REST endpoint for calculating Address Trust Score (ATS).
 * Compliant with AFROLOC Handbook Chapter 12 specifications.
 * 
 * Request Body (Option 1 - by record ID):
 * {
 *   "afrolocRecordId": string    // UUID of the AFROLOC record
 * }
 * 
 * Request Body (Option 2 - by code):
 * {
 *   "afrolocCode": string        // AFROLOC code
 * }
 * 
 * Request Body (Option 3 - direct input for simulation):
 * {
 *   "directInput": {
 *     "gps": { "hasGPS": boolean, "accuracy": number, "validated": boolean },
 *     "telecom": { "hasData": boolean, "operatorVerified": boolean, "signalQuality": string },
 *     "exif": { "hasExif": boolean, "hasGPSMatch": boolean, "gpsExifDistance": number },
 *     "witnesses": { "count": number, "confirmedCount": number, "averageReputation": number },
 *     "audit": { "hasDocuments": boolean, "documentsVerified": boolean }
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": boolean,
 *   "data": {
 *     "score": { "gps": number, "telecom": number, "exif": number, "witness": number, "audit": number, "total": number },
 *     "certificationLevel": { "level": number, "name": string, "description": string },
 *     "recommendations": string[],
 *     "validationFlags": {...}
 *   },
 *   "error": string | null,
 *   "requestId": string,
 *   "timestamp": string
 * }
 */

interface ATSScoreRequest {
  afrolocRecordId?: string;
  afrolocCode?: string;
  directInput?: DirectInput;
}

interface GPSInput {
  hasGPS: boolean;
  accuracy?: number;
  validated?: boolean;
  withinCountryBounds?: boolean;
}

interface TelecomInput {
  hasData: boolean;
  operatorVerified?: boolean;
  signalQuality?: 'poor' | 'fair' | 'good' | 'excellent';
  triangulationConfidence?: number;
}

interface EXIFInput {
  hasExif: boolean;
  hasGPSMatch?: boolean;
  hasTimestamp?: boolean;
  hasDeviceInfo?: boolean;
  gpsExifDistance?: number;
}

interface WitnessInput {
  count: number;
  confirmedCount: number;
  validatedCount?: number;
  averageReputation?: number;
}

interface AuditInput {
  hasDocuments: boolean;
  documentsVerified?: boolean;
  hasFieldAudit?: boolean;
  auditPassed?: boolean;
}

interface DirectInput {
  gps: GPSInput;
  telecom: TelecomInput;
  exif: EXIFInput;
  witnesses: WitnessInput;
  audit: AuditInput;
}

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  requestId: string;
  timestamp: string;
}

// Max points per category
const MAX_GPS = 25;
const MAX_TELECOM = 25;
const MAX_EXIF = 20;
const MAX_WITNESS = 15;
const MAX_AUDIT = 15;

const CERTIFICATION_LEVELS = [
  { level: 0, name: 'Não Certificado', description: 'Sem dados suficientes', color: '#6b7280', minScore: 0 },
  { level: 1, name: 'Básico', description: 'Verificação inicial', color: '#ef4444', minScore: 20 },
  { level: 2, name: 'Verificado', description: 'Múltiplas fontes', color: '#f59e0b', minScore: 40 },
  { level: 3, name: 'Validado', description: 'Testemunhas confirmadas', color: '#22c55e', minScore: 60 },
  { level: 4, name: 'Certificado', description: 'Auditoria completa', color: '#3b82f6', minScore: 80 },
];

function generateRequestId(): string {
  return `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

function calculateGPSScore(gps: GPSInput): number {
  if (!gps.hasGPS) return 0;
  let score = 10;
  if (gps.accuracy !== undefined) {
    if (gps.accuracy <= 5) score += 8;
    else if (gps.accuracy <= 10) score += 6;
    else if (gps.accuracy <= 20) score += 4;
    else if (gps.accuracy <= 50) score += 2;
  }
  if (gps.validated) score += 3;
  if (gps.withinCountryBounds) score += 2;
  return Math.min(MAX_GPS, score);
}

function calculateTelecomScore(telecom: TelecomInput): number {
  if (!telecom.hasData) return 0;
  let score = 5;
  if (telecom.operatorVerified) score += 5;
  switch (telecom.signalQuality) {
    case 'excellent': score += 8; break;
    case 'good': score += 6; break;
    case 'fair': score += 4; break;
    case 'poor': score += 2; break;
  }
  if (telecom.triangulationConfidence !== undefined) {
    score += Math.round(telecom.triangulationConfidence * 7);
  }
  return Math.min(MAX_TELECOM, score);
}

function calculateEXIFScore(exif: EXIFInput): number {
  if (!exif.hasExif) return 0;
  let score = 5;
  if (exif.hasGPSMatch) {
    if (exif.gpsExifDistance !== undefined) {
      if (exif.gpsExifDistance <= 10) score += 8;
      else if (exif.gpsExifDistance <= 50) score += 6;
      else if (exif.gpsExifDistance <= 100) score += 4;
      else score += 2;
    } else {
      score += 5;
    }
  }
  if (exif.hasTimestamp) score += 4;
  if (exif.hasDeviceInfo) score += 3;
  return Math.min(MAX_EXIF, score);
}

function calculateWitnessScore(witnesses: WitnessInput): number {
  if (witnesses.count === 0) return 0;
  let score = 0;
  if (witnesses.confirmedCount >= 3) score += 7.5;
  else if (witnesses.confirmedCount >= 2) score += 5.0;
  else if (witnesses.confirmedCount >= 1) score += 2.5;
  if (witnesses.validatedCount !== undefined) {
    score += Math.min(5, witnesses.validatedCount * 2.5);
  }
  const reputation = witnesses.averageReputation ?? 50;
  const reputationMultiplier = 0.5 + (reputation / 200);
  score = score * reputationMultiplier;
  return Math.min(MAX_WITNESS, score);
}

function calculateAuditScore(audit: AuditInput): number {
  let score = 0;
  if (audit.hasDocuments) {
    score += 4;
    if (audit.documentsVerified) score += 3;
  }
  if (audit.hasFieldAudit) {
    score += 4;
    if (audit.auditPassed) score += 4;
  }
  return Math.min(MAX_AUDIT, score);
}

function getCertificationLevel(score: number) {
  for (let i = CERTIFICATION_LEVELS.length - 1; i >= 0; i--) {
    if (score >= CERTIFICATION_LEVELS[i].minScore) {
      return CERTIFICATION_LEVELS[i];
    }
  }
  return CERTIFICATION_LEVELS[0];
}

function generateRecommendations(input: DirectInput, scores: any): string[] {
  const recommendations: string[] = [];
  if (scores.gps < 15) {
    if (!input.gps.hasGPS) recommendations.push('Capture GPS coordinates to improve trust score');
    else if (!input.gps.validated) recommendations.push('Request GPS validation from an authority');
  }
  if (scores.telecom < 15) {
    if (!input.telecom.hasData) recommendations.push('Enable telecom data capture for triangulation');
    else if (!input.telecom.operatorVerified) recommendations.push('Verify phone number with telecom operator');
  }
  if (scores.exif < 12) {
    if (!input.exif.hasExif) recommendations.push('Capture photos with EXIF metadata enabled');
    else if (!input.exif.hasGPSMatch) recommendations.push('Ensure photo GPS matches device GPS');
  }
  if (scores.witness < 10) {
    if (input.witnesses.count < 2) recommendations.push('Add at least 2 witnesses for verification');
    else if (input.witnesses.confirmedCount < input.witnesses.count) recommendations.push('Request witness confirmations');
  }
  if (scores.audit < 8) {
    if (!input.audit.hasDocuments) recommendations.push('Upload identity documents for verification');
    else if (!input.audit.hasFieldAudit) recommendations.push('Request a field audit for higher certification');
  }
  return recommendations;
}

function checkValidationFlags(input: DirectInput, scores: any) {
  return {
    spoofingRisk: input.exif.hasExif && input.gps.hasGPS && !input.exif.hasGPSMatch && 
                  input.exif.gpsExifDistance !== undefined && input.exif.gpsExifDistance > 100,
    lowConfidence: scores.total < 30,
    missingData: !input.gps.hasGPS || !input.exif.hasExif || input.witnesses.count === 0,
    inconsistentData: input.telecom.hasData && input.gps.hasGPS && 
                      input.telecom.triangulationConfidence !== undefined &&
                      input.telecom.triangulationConfidence < 0.3,
  };
}

async function fetchRecordData(supabase: any, recordId: string): Promise<DirectInput | null> {
  const { data: record, error: recordError } = await supabase
    .from('afroloc_records')
    .select('*')
    .eq('id', recordId)
    .single();
  
  if (recordError || !record) return null;
  
  const { data: witnesses } = await supabase
    .from('afroloc_witnesses')
    .select('status, validated_at, witness_reputation_score')
    .eq('afroloc_record_id', recordId);
  
  const { data: documents } = await supabase
    .from('identity_documents')
    .select('status')
    .eq('afroloc_record_id', recordId);
  
  const hasGPS = record.geo_lat !== null && record.geo_lon !== null;
  const hasExif = record.photo_exif_gps_lat !== null || record.photo_exif_timestamp !== null;
  
  let gpsExifDistance: number | undefined;
  if (hasGPS && record.photo_exif_gps_lat !== null && record.photo_exif_gps_lon !== null) {
    const latDiff = Math.abs(record.geo_lat - record.photo_exif_gps_lat);
    const lonDiff = Math.abs(record.geo_lon - record.photo_exif_gps_lon);
    gpsExifDistance = Math.sqrt(Math.pow(latDiff * 111000, 2) + Math.pow(lonDiff * 111000, 2));
  }
  
  const witnessArray = witnesses || [];
  const confirmedWitnesses = witnessArray.filter((w: any) => w.status === 'confirmed');
  const validatedWitnesses = witnessArray.filter((w: any) => w.validated_at !== null);
  const averageReputation = confirmedWitnesses.length > 0
    ? confirmedWitnesses.reduce((sum: number, w: any) => sum + (w.witness_reputation_score || 50), 0) / confirmedWitnesses.length
    : 50;
  
  const documentArray = documents || [];
  const verifiedDocs = documentArray.filter((d: any) => d.status === 'verified');
  
  return {
    gps: {
      hasGPS,
      accuracy: hasGPS ? 10 : undefined,
      validated: record.gps_validated_at !== null,
      withinCountryBounds: true,
    },
    telecom: {
      hasData: false,
      operatorVerified: false,
      signalQuality: undefined,
      triangulationConfidence: undefined,
    },
    exif: {
      hasExif,
      hasGPSMatch: gpsExifDistance !== undefined ? gpsExifDistance < 100 : undefined,
      hasTimestamp: record.photo_exif_timestamp !== null,
      hasDeviceInfo: record.photo_exif_device_make !== null,
      gpsExifDistance,
    },
    witnesses: {
      count: witnessArray.length,
      confirmedCount: confirmedWitnesses.length,
      validatedCount: validatedWitnesses.length,
      averageReputation,
    },
    audit: {
      hasDocuments: documentArray.length > 0,
      documentsVerified: verifiedDocs.length > 0,
      hasFieldAudit: false,
      auditPassed: false,
    },
  };
}

serve(async (req) => {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const body: ATSScoreRequest = await req.json();
    
    if (!body.afrolocRecordId && !body.afrolocCode && !body.directInput) {
      const response: ApiResponse = {
        success: false,
        error: 'One of afrolocRecordId, afrolocCode, or directInput is required',
        requestId,
        timestamp,
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let input: DirectInput;
    let recordId: string | undefined;
    let afrolocCode: string | undefined;

    if (body.directInput) {
      input = body.directInput;
      console.log(`[${requestId}] Computing ATS from direct input`);
    } else {
      // Lookup by code if provided
      if (body.afrolocCode) {
        const { data: record, error } = await supabase
          .from('afroloc_records')
          .select('id, code')
          .eq('code', body.afrolocCode)
          .single();
        
        if (error || !record) {
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
        recordId = record.id;
        afrolocCode = record.code;
      } else {
        recordId = body.afrolocRecordId;
      }

      console.log(`[${requestId}] Computing ATS for record ${recordId}`);
      
      const fetchedData = await fetchRecordData(supabase, recordId!);
      if (!fetchedData) {
        const response: ApiResponse = {
          success: false,
          error: 'Could not fetch record data',
          requestId,
          timestamp,
        };
        return new Response(JSON.stringify(response), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      input = fetchedData;
    }

    // Calculate scores
    const scores = {
      gps: calculateGPSScore(input.gps),
      telecom: calculateTelecomScore(input.telecom),
      exif: calculateEXIFScore(input.exif),
      witness: calculateWitnessScore(input.witnesses),
      audit: calculateAuditScore(input.audit),
      total: 0,
    };
    scores.total = scores.gps + scores.telecom + scores.exif + scores.witness + scores.audit;

    const certLevel = getCertificationLevel(scores.total);
    const recommendations = generateRecommendations(input, scores);
    const validationFlags = checkValidationFlags(input, scores);

    console.log(`[${requestId}] ATS Score: ${scores.total}, Level: ${certLevel.level}`);

    // Log audit
    await supabase.from('security_audit_log').insert({
      user_id: user.id,
      action: 'ats_score_compute',
      function_name: 'ats-score',
      details: {
        requestId,
        recordId,
        afrolocCode,
        score: scores.total,
        certificationLevel: certLevel.level,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: {
        score: scores,
        scoreBreakdown: {
          gps: { score: scores.gps, max: MAX_GPS, percentage: Math.round(scores.gps / MAX_GPS * 100) },
          telecom: { score: scores.telecom, max: MAX_TELECOM, percentage: Math.round(scores.telecom / MAX_TELECOM * 100) },
          exif: { score: scores.exif, max: MAX_EXIF, percentage: Math.round(scores.exif / MAX_EXIF * 100) },
          witness: { score: scores.witness, max: MAX_WITNESS, percentage: Math.round(scores.witness / MAX_WITNESS * 100) },
          audit: { score: scores.audit, max: MAX_AUDIT, percentage: Math.round(scores.audit / MAX_AUDIT * 100) },
        },
        certificationLevel: {
          level: certLevel.level,
          name: certLevel.name,
          description: certLevel.description,
          color: certLevel.color,
          minScore: certLevel.minScore,
        },
        recommendations,
        validationFlags,
        inputSummary: {
          hasGPS: input.gps.hasGPS,
          gpsValidated: input.gps.validated,
          hasTelecom: input.telecom.hasData,
          hasExif: input.exif.hasExif,
          witnessCount: input.witnesses.count,
          confirmedWitnesses: input.witnesses.confirmedCount,
          hasDocuments: input.audit.hasDocuments,
        },
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
