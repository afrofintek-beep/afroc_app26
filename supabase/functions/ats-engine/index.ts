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
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/auth_rbac.ts";
/**
 * ATS ENGINE — ADDRESS TRUST SCORE
 * 
 * Server-side computation of the Address Trust Score.
 * 
 * Weighted scoring algorithm:
 *   - GPS (0–25 points)
 *   - Telecom (0–25 points)
 *   - EXIF validation (0–20 points)
 *   - Witness validation (0–15 points)
 *   - Audit/documentation (0–15 points)
 * 
 * Total: 0–100, mapped to certification levels 0–4.
 */

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
  averageReputation?: number; // 0-100 reputation score
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

interface ATSRequest {
  afroidRecordId?: string;
  directInput?: DirectInput;
}

interface ATSScoreBreakdown {
  gps: number;
  telecom: number;
  exif: number;
  witness: number;
  audit: number;
  total: number;
}

interface CertificationLevel {
  level: number;
  name: string;
  description: string;
  color: string;
  minScore: number;
}

interface ATSResponse {
  score: ATSScoreBreakdown;
  certificationLevel: CertificationLevel;
  recommendations: string[];
  validationFlags: {
    spoofingRisk: boolean;
    lowConfidence: boolean;
    missingData: boolean;
    inconsistentData: boolean;
  };
}

// Max points per category
const MAX_GPS = 25;
const MAX_TELECOM = 25;
const MAX_EXIF = 20;
const MAX_WITNESS = 15;
const MAX_AUDIT = 15;

// Certification levels
const CERTIFICATION_LEVELS: CertificationLevel[] = [
  { level: 0, name: 'Não Certificado', description: 'Sem dados suficientes', color: '#6b7280', minScore: 0 },
  { level: 1, name: 'Básico', description: 'Verificação inicial', color: '#ef4444', minScore: 20 },
  { level: 2, name: 'Verificado', description: 'Múltiplas fontes', color: '#f59e0b', minScore: 40 },
  { level: 3, name: 'Validado', description: 'Testemunhas confirmadas', color: '#22c55e', minScore: 60 },
  { level: 4, name: 'Certificado', description: 'Auditoria completa', color: '#3b82f6', minScore: 80 },
];
/**
 * Calculate GPS score
 */
function calculateGPSScore(gps: GPSInput): number {
  if (!gps.hasGPS) return 0;
  
  let score = 10; // Base score for having GPS
  
  // Accuracy bonus (0-8 points)
  if (gps.accuracy !== undefined) {
    if (gps.accuracy <= 5) score += 8;
    else if (gps.accuracy <= 10) score += 6;
    else if (gps.accuracy <= 20) score += 4;
    else if (gps.accuracy <= 50) score += 2;
  }
  
  // Validation bonus (0-5 points)
  if (gps.validated) score += 3;
  if (gps.withinCountryBounds) score += 2;
  
  return Math.min(MAX_GPS, score);
}

/**
 * Calculate Telecom score
 */
function calculateTelecomScore(telecom: TelecomInput): number {
  if (!telecom.hasData) return 0;
  
  let score = 5; // Base score for having telecom data
  
  // Operator verification (0-5 points)
  if (telecom.operatorVerified) score += 5;
  
  // Signal quality (0-8 points)
  switch (telecom.signalQuality) {
    case 'excellent': score += 8; break;
    case 'good': score += 6; break;
    case 'fair': score += 4; break;
    case 'poor': score += 2; break;
  }
  
  // Triangulation confidence (0-7 points)
  if (telecom.triangulationConfidence !== undefined) {
    score += Math.round(telecom.triangulationConfidence * 7);
  }
  
  return Math.min(MAX_TELECOM, score);
}

/**
 * Calculate EXIF score
 */
function calculateEXIFScore(exif: EXIFInput): number {
  if (!exif.hasExif) return 0;
  
  let score = 5; // Base score for having EXIF
  
  // GPS match (0-8 points)
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
  
  // Timestamp (0-4 points)
  if (exif.hasTimestamp) score += 4;
  
  // Device info (0-3 points)
  if (exif.hasDeviceInfo) score += 3;
  
  return Math.min(MAX_EXIF, score);
}

/**
 * Calculate Witness score - weighted by reputation per AFROLOC Handbook Chapter 4
 */
function calculateWitnessScore(witnesses: WitnessInput): number {
  if (witnesses.count === 0) return 0;
  
  let score = 0;
  
  // Base score for confirmed witnesses (0-7.5 points)
  if (witnesses.confirmedCount >= 3) {
    score += 7.5;
  } else if (witnesses.confirmedCount >= 2) {
    score += 5.0;
  } else if (witnesses.confirmedCount >= 1) {
    score += 2.5;
  }
  
  // Validated witnesses bonus (0-5 points)
  if (witnesses.validatedCount !== undefined) {
    score += Math.min(5, witnesses.validatedCount * 2.5);
  }
  
  // Apply reputation multiplier (scales from 0.5 at 0 rep to 1.0 at 100 rep)
  // Higher reputation witnesses contribute more to the score
  const reputation = witnesses.averageReputation ?? 50;
  const reputationMultiplier = 0.5 + (reputation / 200);
  score = score * reputationMultiplier;
  
  return Math.min(MAX_WITNESS, score);
}

/**
 * Calculate Audit score
 */
function calculateAuditScore(audit: AuditInput): number {
  let score = 0;
  
  // Documents (0-7 points)
  if (audit.hasDocuments) {
    score += 4;
    if (audit.documentsVerified) score += 3;
  }
  
  // Field audit (0-8 points)
  if (audit.hasFieldAudit) {
    score += 4;
    if (audit.auditPassed) score += 4;
  }
  
  return Math.min(MAX_AUDIT, score);
}

/**
 * Get certification level from score
 */
function getCertificationLevel(score: number): CertificationLevel {
  for (let i = CERTIFICATION_LEVELS.length - 1; i >= 0; i--) {
    if (score >= CERTIFICATION_LEVELS[i].minScore) {
      return CERTIFICATION_LEVELS[i];
    }
  }
  return CERTIFICATION_LEVELS[0];
}

/**
 * Generate recommendations based on score breakdown
 */
function generateRecommendations(
  input: DirectInput,
  scores: ATSScoreBreakdown
): string[] {
  const recommendations: string[] = [];
  
  // GPS recommendations
  if (scores.gps < 15) {
    if (!input.gps.hasGPS) {
      recommendations.push('Capture GPS coordinates to improve trust score');
    } else if (!input.gps.validated) {
      recommendations.push('Request GPS validation from an authority');
    }
  }
  
  // Telecom recommendations
  if (scores.telecom < 15) {
    if (!input.telecom.hasData) {
      recommendations.push('Enable telecom data capture for triangulation');
    } else if (!input.telecom.operatorVerified) {
      recommendations.push('Verify phone number with telecom operator');
    }
  }
  
  // EXIF recommendations
  if (scores.exif < 12) {
    if (!input.exif.hasExif) {
      recommendations.push('Capture photos with EXIF metadata enabled');
    } else if (!input.exif.hasGPSMatch) {
      recommendations.push('Ensure photo GPS matches device GPS');
    }
  }
  
  // Witness recommendations
  if (scores.witness < 10) {
    if (input.witnesses.count < 2) {
      recommendations.push('Add at least 2 witnesses for verification');
    } else if (input.witnesses.confirmedCount < input.witnesses.count) {
      recommendations.push('Request witness confirmations');
    }
  }
  
  // Audit recommendations
  if (scores.audit < 8) {
    if (!input.audit.hasDocuments) {
      recommendations.push('Upload identity documents for verification');
    } else if (!input.audit.hasFieldAudit) {
      recommendations.push('Request a field audit for higher certification');
    }
  }
  
  return recommendations;
}

/**
 * Check for validation flags
 */
function checkValidationFlags(
  input: DirectInput,
  scores: ATSScoreBreakdown
): ATSResponse['validationFlags'] {
  const flags = {
    spoofingRisk: false,
    lowConfidence: false,
    missingData: false,
    inconsistentData: false,
  };
  
  // Check for spoofing risk
  if (input.exif.hasExif && input.gps.hasGPS && !input.exif.hasGPSMatch) {
    if (input.exif.gpsExifDistance !== undefined && input.exif.gpsExifDistance > 100) {
      flags.spoofingRisk = true;
    }
  }
  
  // Check for low confidence
  if (scores.total < 30) {
    flags.lowConfidence = true;
  }
  
  // Check for missing data
  if (!input.gps.hasGPS || !input.exif.hasExif || input.witnesses.count === 0) {
    flags.missingData = true;
  }
  
  // Check for inconsistent data
  if (input.telecom.hasData && input.gps.hasGPS && 
      input.telecom.triangulationConfidence !== undefined &&
      input.telecom.triangulationConfidence < 0.3) {
    flags.inconsistentData = true;
  }
  
  return flags;
}

/**
 * Fetch data from database for a record
 */
async function fetchRecordData(supabase: any, recordId: string): Promise<DirectInput | null> {
  try {
    // Fetch the AFROID record
    const { data: record, error: recordError } = await supabase
      .from('afroloc_records')
      .select('*')
      .eq('id', recordId)
      .single();
    
    if (recordError || !record) {
      console.error('Error fetching record:', recordError);
      return null;
    }
    
    // Fetch witnesses with reputation scores
    const { data: witnesses, error: witnessError } = await supabase
      .from('afroloc_witnesses')
      .select('status, validated_at, witness_reputation_score')
      .eq('afroloc_record_id', recordId);
    
    if (witnessError) {
      console.error('Error fetching witnesses:', witnessError);
    }
    
    // Fetch documents
    const { data: documents, error: docError } = await supabase
      .from('identity_documents')
      .select('status')
      .eq('afroloc_record_id', recordId);
    
    if (docError) {
      console.error('Error fetching documents:', docError);
    }
    
    // Build input from record data
    const hasGPS = record.geo_lat !== null && record.geo_lon !== null;
    const hasExif = record.photo_exif_gps_lat !== null || record.photo_exif_timestamp !== null;
    
    // Calculate GPS-EXIF distance if both available
    let gpsExifDistance: number | undefined;
    if (hasGPS && record.photo_exif_gps_lat !== null && record.photo_exif_gps_lon !== null) {
      const latDiff = Math.abs(record.geo_lat - record.photo_exif_gps_lat);
      const lonDiff = Math.abs(record.geo_lon - record.photo_exif_gps_lon);
      gpsExifDistance = Math.sqrt(Math.pow(latDiff * 111000, 2) + Math.pow(lonDiff * 111000, 2));
    }
    
    const witnessArray = witnesses || [];
    const confirmedWitnesses = witnessArray.filter((w: any) => w.status === 'confirmed');
    const validatedWitnesses = witnessArray.filter((w: any) => w.validated_at !== null);
    
    // Calculate average reputation of confirmed witnesses
    const averageReputation = confirmedWitnesses.length > 0
      ? confirmedWitnesses.reduce((sum: number, w: any) => sum + (w.witness_reputation_score || 50), 0) / confirmedWitnesses.length
      : 50;
    
    const documentArray = documents || [];
    const verifiedDocs = documentArray.filter((d: any) => d.status === 'verified');
    
    return {
      gps: {
        hasGPS,
        accuracy: hasGPS ? 10 : undefined, // Default accuracy if not stored
        validated: record.gps_validated_at !== null,
        withinCountryBounds: true, // Assume validated if stored
      },
      telecom: {
        hasData: false, // TODO: Link to telecom data when available
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
        averageReputation: averageReputation,
      },
      audit: {
        hasDocuments: documentArray.length > 0,
        documentsVerified: verifiedDocs.length > 0,
        hasFieldAudit: false, // TODO: Link to audit data when available
        auditPassed: false,
      },
    };
  } catch (err) {
    console.error('Exception in fetchRecordData:', err);
    return null;
  }
}

/**
 * Main ATS computation
 */
async function computeATS(request: ATSRequest, supabase: any): Promise<ATSResponse> {
  let input: DirectInput;
  
  if (request.directInput) {
    input = request.directInput;
  } else if (request.afroidRecordId) {
    const fetchedData = await fetchRecordData(supabase, request.afroidRecordId);
    if (!fetchedData) {
      throw new Error('Could not fetch record data');
    }
    input = fetchedData;
  } else {
    throw new Error('Either afroidRecordId or directInput must be provided');
  }
  
  // Calculate individual scores
  const scores: ATSScoreBreakdown = {
    gps: calculateGPSScore(input.gps),
    telecom: calculateTelecomScore(input.telecom),
    exif: calculateEXIFScore(input.exif),
    witness: calculateWitnessScore(input.witnesses),
    audit: calculateAuditScore(input.audit),
    total: 0,
  };
  
  // Calculate total
  scores.total = scores.gps + scores.telecom + scores.exif + scores.witness + scores.audit;
  
  // Get certification level
  const certLevel = getCertificationLevel(scores.total);
  
  // Generate recommendations
  const recommendations = generateRecommendations(input, scores);
  
  // Check validation flags
  const validationFlags = checkValidationFlags(input, scores);
  
  return {
    score: scores,
    certificationLevel: certLevel,
    recommendations,
    validationFlags,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const request: ATSRequest = await req.json();
    
    // Validate input
    if (!request.afroidRecordId && !request.directInput) {
      return new Response(
        JSON.stringify({ error: 'Either afroidRecordId or directInput must be provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`ATS Engine: Computing score for ${request.afroidRecordId || 'direct input'}`);
    
    const result = await computeATS(request, supabase);

    console.log(`ATS Engine: Score ${result.score.total}, Level ${result.certificationLevel.level}`);

    // Persistir no registo (fonte de verdade para o cliente LER, em vez de
    // recalcular o algoritmo no browser). Só quando temos um registo real.
    if (request.afroidRecordId) {
      const { error: persistErr } = await supabase
        .from('afroloc_records')
        .update({
          ats_score: Math.round(result.score.total),
          ats_breakdown: result.score,
          certification_level: result.certificationLevel.level,
          ats_computed_at: new Date().toISOString(),
        })
        .eq('id', request.afroidRecordId);
      if (persistErr) console.error('ATS persist error:', persistErr.message);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('ATS Engine error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
