import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/auth_rbac.ts";

/**
 * ADDRESS GATEWAY — NATIONAL INTEGRATION LAYER
 * 
 * Unified API gateway for AFROLOC operations:
 *   /create  - Create new address with QG/SQ codes
 *   /verify  - Verify existing address
 *   /certify - Request certification
 *   /lookup  - Lookup address by code
 * 
 * Security:
 *   - JWT authentication
 *   - Rate limiting (via header tracking)
 *   - Geo-fencing validation
 *   - Audit logging
 */

interface CreateAddressRequest {
  action: 'create';
  latitude: number;
  longitude: number;
  countryCode: string;
  userId: string;
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

interface VerifyAddressRequest {
  action: 'verify';
  afroidCode: string;
  verificationData: {
    currentLatitude: number;
    currentLongitude: number;
    witnessIds?: string[];
  };
}

interface CertifyAddressRequest {
  action: 'certify';
  afroidRecordId: string;
  certificationLevel: number;
  validatorId: string;
  notes?: string;
}

interface LookupAddressRequest {
  action: 'lookup';
  code?: string;
  qgCode?: string;
  latitude?: number;
  longitude?: number;
}

interface ListAddressRequest {
  action: 'list';
  countryCode?: string;
  limit?: number;
}

interface ValidateCodeRequest {
  action: 'validate';
  code: string;
}

interface DecodeCodeRequest {
  action: 'decode';
  code: string;
}

interface DeleteAddressRequest {
  action: 'delete';
  recordId?: string;
  code?: string;
}

type GatewayRequest = CreateAddressRequest | VerifyAddressRequest | CertifyAddressRequest | LookupAddressRequest | ListAddressRequest | ValidateCodeRequest | DecodeCodeRequest | DeleteAddressRequest;

interface GatewayResponse {
  success: boolean;
  data?: any;
  error?: string;
  requestId: string;
  timestamp: string;
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

/**
 * Validate country is in Africa
 */
function validateAfricanCountry(countryCode: string): boolean {
  const africanCountries = [
    'AO', 'BJ', 'BW', 'BF', 'BI', 'CM', 'CV', 'CF', 'TD', 'KM',
    'CG', 'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'ET', 'GA', 'GM',
    'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML',
    'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW', 'ST', 'SN',
    'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'SZ', 'TZ', 'TG', 'TN',
    'UG', 'ZM', 'ZW'
  ];
  return africanCountries.includes(countryCode.toUpperCase());
}

/**
 * Call QG Engine to get grid code
 */
async function callQGEngine(
  latitude: number,
  longitude: number,
  countryCode: string
): Promise<any> {
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

/**
 * Call QG Engine to validate and convert legacy codes
 */
async function validateAfrolocCode(code: string): Promise<any> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/qg-engine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ action: 'validate', code }),
  });
  
  if (!response.ok) {
    throw new Error(`QG Engine validation error: ${await response.text()}`);
  }
  
  return response.json();
}

/**
 * Call QG Engine to decode a code
 */
async function decodeAfrolocCode(code: string): Promise<any> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/qg-engine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ code }),
  });
  
  if (!response.ok) {
    throw new Error(`QG Engine decode error: ${await response.text()}`);
  }
  
  return response.json();
}

/**
 * Call SQ Engine to get subdivision code
 */
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

/**
 * Call ATS Engine to compute score
 */
async function callATSEngine(afroidRecordId: string): Promise<any> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/ats-engine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ afroidRecordId }),
  });
  
  if (!response.ok) {
    throw new Error(`ATS Engine error: ${await response.text()}`);
  }
  
  return response.json();
}

/**
 * Generate unique AFROLOC code
 */
function generateAfrolocCode(
  countryCode: string,
  sqFullCode: string,
  sequence: number
): string {
  const seq = sequence.toString().padStart(4, '0');
  return `${sqFullCode}-${seq}`;
}

/**
 * Handle CREATE action
 */
async function handleCreate(
  request: any,
  supabase: any
): Promise<any> {
  const { latitude, longitude, countryCode, userId, photoMetadata } = request;
  
  // Support both nested addressDetails and flat structure
  const addressDetails = request.addressDetails || {
    level1Code: request.level1Code,
    level1Name: request.level1Name,
    level2Code: request.level2Code,
    level2Name: request.level2Name,
    level3Code: request.level3Code,
    level3Name: request.level3Name,
    level4Code: request.level4Code,
    level4Name: request.level4Name,
    streetName: request.streetName,
    number: request.number,
    unit: request.unit,
    propertyType: request.propertyType,
  };
  
  // Validate African country
  if (!validateAfricanCountry(countryCode)) {
    throw new Error('Country must be within Africa');
  }
  
  // Get QG code
  const qgResult = await callQGEngine(latitude, longitude, countryCode);
  
  // Get SQ code
  const sqResult = await callSQEngine(
    qgResult.qgCode,
    latitude,
    longitude,
    qgResult.bounds,
    countryCode
  );
  
  // Get sequence number for this SQ cell
  const { count } = await supabase
    .from('afroloc_records')
    .select('*', { count: 'exact', head: true })
    .like('code', `${sqResult.fullCode}%`);
  
  const sequence = (count || 0) + 1;
  
  // Generate AFROLOC code
  const afrolocCode = generateAfrolocCode(countryCode, sqResult.fullCode, sequence);
  
  // Create the record
  const { data: record, error } = await supabase
    .from('afroloc_records')
    .insert({
      code: afrolocCode,
      country: countryCode,
      user_id: userId,
      geo_lat: latitude,
      geo_lon: longitude,
      level1_code: addressDetails.level1Code,
      level1_name: addressDetails.level1Name,
      level2_code: addressDetails.level2Code,
      level2_name: addressDetails.level2Name,
      level3_code: addressDetails.level3Code,
      level3_name: addressDetails.level3Name,
      level4_code: addressDetails.level4Code,
      level4_name: addressDetails.level4Name,
      street_name: addressDetails.streetName,
      number: addressDetails.number,
      unit: addressDetails.unit,
      property_type: addressDetails.propertyType,
      photo_exif_gps_lat: photoMetadata?.exifLat,
      photo_exif_gps_lon: photoMetadata?.exifLon,
      photo_exif_timestamp: photoMetadata?.exifTimestamp,
      photo_exif_device_make: photoMetadata?.deviceMake,
      photo_exif_device_model: photoMetadata?.deviceModel,
      status: 'draft',
      metadata: {
        qgCode: qgResult.qgCode,
        sqCode: sqResult.sqCode,
        cellType: qgResult.cellType,
        subdivisionType: sqResult.subdivisionType,
        densityMetrics: sqResult.densityMetrics,
      },
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create record: ${error.message}`);
  }
  
  // Compute initial ATS score
  const atsResult = await callATSEngine(record.id);
  
  return {
    afrolocCode,
    recordId: record.id,
    qgCode: qgResult.qgCode,
    sqCode: sqResult.sqCode,
    fullCode: sqResult.fullCode,
    cellType: qgResult.cellType,
    subdivisionType: sqResult.subdivisionType,
    bounds: sqResult.subCellBounds,
    atsScore: atsResult.score,
    certificationLevel: atsResult.certificationLevel,
  };
}

/**
 * Handle VERIFY action
 */
async function handleVerify(
  request: VerifyAddressRequest,
  supabase: any
): Promise<any> {
  const { afroidCode, verificationData } = request;
  
  // Lookup the record
  const { data: record, error } = await supabase
    .from('afroloc_records')
    .select('*')
    .eq('code', afroidCode)
    .single();
  
  if (error || !record) {
    throw new Error('Address not found');
  }
  
  // Calculate distance from stored coordinates
  const latDiff = Math.abs(record.geo_lat - verificationData.currentLatitude);
  const lonDiff = Math.abs(record.geo_lon - verificationData.currentLongitude);
  const distanceMeters = Math.sqrt(
    Math.pow(latDiff * 111000, 2) + Math.pow(lonDiff * 111000, 2)
  );
  
  // Verification threshold (100m for urban, 500m for rural)
  const isUrban = record.metadata?.cellType === 'urban';
  const threshold = isUrban ? 100 : 500;
  const isLocationMatch = distanceMeters <= threshold;
  
  // Get current ATS score
  const atsResult = await callATSEngine(record.id);
  
  return {
    verified: isLocationMatch,
    distanceMeters,
    threshold,
    record: {
      code: record.code,
      country: record.country,
      status: record.status,
      createdAt: record.created_at,
    },
    atsScore: atsResult.score,
    certificationLevel: atsResult.certificationLevel,
  };
}

/**
 * Handle CERTIFY action
 */
async function handleCertify(
  request: CertifyAddressRequest,
  supabase: any
): Promise<any> {
  const { afroidRecordId, certificationLevel, validatorId, notes } = request;
  
  // Validate certification level
  if (certificationLevel < 1 || certificationLevel > 4) {
    throw new Error('Certification level must be between 1 and 4');
  }
  
  // Get current record
  const { data: record, error: recordError } = await supabase
    .from('afroloc_records')
    .select('*')
    .eq('id', afroidRecordId)
    .single();
  
  if (recordError || !record) {
    throw new Error('Record not found');
  }
  
  // Validate current ATS score supports the certification level
  const atsResult = await callATSEngine(afroidRecordId);
  
  if (atsResult.certificationLevel.level < certificationLevel) {
    throw new Error(
      `ATS score (${atsResult.score.total}) is too low for certification level ${certificationLevel}. ` +
      `Current maximum level: ${atsResult.certificationLevel.level}`
    );
  }
  
  // Create validation record
  const { data: validation, error: validationError } = await supabase
    .from('afroloc_validations')
    .insert({
      afroloc_record_id: afroidRecordId,
      validation_method: `certification_level_${certificationLevel}`,
      authority_role: 'certified_validator',
      authority_signature: validatorId,
      notes,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
    })
    .select()
    .single();
  
  if (validationError) {
    throw new Error(`Failed to create validation: ${validationError.message}`);
  }
  
  // Update record status
  const newStatus = certificationLevel >= 3 ? 'certified' : 'verified';
  await supabase
    .from('afroloc_records')
    .update({
      status: newStatus,
      approved_at: new Date().toISOString(),
      approved_by_user_id: validatorId,
      last_verified_at: new Date().toISOString(),
    })
    .eq('id', afroidRecordId);
  
  return {
    certified: true,
    validationId: validation.id,
    newStatus,
    certificationLevel,
    expiresAt: validation.expires_at,
    atsScore: atsResult.score,
  };
}

/**
 * Handle LOOKUP action
 */
async function handleLookup(
  request: LookupAddressRequest,
  supabase: any
): Promise<any> {
  if (request.code) {
    // Lookup by AFROLOC code
    const { data: record, error } = await supabase
      .from('afroloc_records')
      .select('*')
      .eq('code', request.code)
      .single();
    
    if (error || !record) {
      throw new Error('Address not found');
    }
    
    const atsResult = await callATSEngine(record.id);
    
    return {
      record,
      atsScore: atsResult.score,
      certificationLevel: atsResult.certificationLevel,
    };
  }
  
  if (request.qgCode) {
    // Lookup by QG code (returns all addresses in grid cell)
    const { data: records, error } = await supabase
      .from('afroloc_records')
      .select('*')
      .like('code', `${request.qgCode}%`)
      .limit(100);
    
    if (error) {
      throw new Error(`Lookup failed: ${error.message}`);
    }
    
    return {
      count: records.length,
      records: records.map((r: any) => ({
        code: r.code,
        status: r.status,
        createdAt: r.created_at,
      })),
    };
  }
  
  if (request.latitude !== undefined && request.longitude !== undefined) {
    // Lookup by coordinates (find nearest)
    const { data: records, error } = await supabase
      .from('afroloc_records')
      .select('*')
      .gte('geo_lat', request.latitude - 0.01)
      .lte('geo_lat', request.latitude + 0.01)
      .gte('geo_lon', request.longitude - 0.01)
      .lte('geo_lon', request.longitude + 0.01)
      .limit(10);
    
    if (error) {
      throw new Error(`Lookup failed: ${error.message}`);
    }
    
    // Calculate distances and sort
    const withDistances = records.map((r: any) => {
      const latDiff = r.geo_lat - request.latitude!;
      const lonDiff = r.geo_lon - request.longitude!;
      const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111000; // meters
      return { ...r, distanceMeters: distance };
    }).sort((a: any, b: any) => a.distanceMeters - b.distanceMeters);
    
    return {
      count: withDistances.length,
      nearest: withDistances[0] || null,
      records: withDistances.slice(0, 5).map((r: any) => ({
        code: r.code,
        distanceMeters: r.distanceMeters,
        status: r.status,
      })),
    };
  }
  
  throw new Error('Lookup requires code, qgCode, or latitude/longitude');
}

/**
 * Handle LIST action - for public demo
 */
async function handleList(
  request: any,
  supabase: any
): Promise<any> {
  const { countryCode, limit = 50 } = request;
  
  let query = supabase
    .from('afroloc_records')
    .select('id, code, country, level1_name, level2_name, level3_name, level4_name, street_name, number, property_type, geo_lat, geo_lon, status, address_type')
    .not('geo_lat', 'is', null)
    .not('geo_lon', 'is', null);
  
  if (countryCode) {
    query = query.eq('country', countryCode);
  }
  
  const { data: records, error } = await query.limit(limit);
  
  if (error) {
    throw new Error(`List failed: ${error.message}`);
  }
  
  return {
    count: records.length,
    records,
  };
}

/**
 * Handle VALIDATE action - validates and converts legacy codes
 */
async function handleValidate(
  request: ValidateCodeRequest
): Promise<any> {
  const { code } = request;
  
  console.log(`Validating AFROLOC code: ${code}`);
  
  const validation = await validateAfrolocCode(code);
  
  return {
    valid: validation.valid,
    normalizedCode: validation.normalizedCode,
    wasConverted: validation.wasConverted || false,
    originalFormat: validation.originalFormat,
    error: validation.error,
  };
}

/**
 * Handle DECODE action - decodes code to geographic data
 */
async function handleDecode(
  request: DecodeCodeRequest
): Promise<any> {
  const { code } = request;
  
  console.log(`Decoding AFROLOC code: ${code}`);
  
  const decoded = await decodeAfrolocCode(code);
  
  return {
    afroloc: decoded.afroloc,
    country: decoded.country,
    zone: decoded.zone,
    gridSize: decoded.grid_m,
    bbox: decoded.bbox,
    centroid: decoded.centroid,
    wasConverted: decoded.wasConverted || false,
    originalFormat: decoded.originalFormat,
  };
}

/**
 * Handle DELETE action
 * - Authenticated user can delete their own drafts
 * - Admin (admin, admin_national) can delete any record
 */
async function handleDelete(
  request: DeleteAddressRequest,
  supabase: any,
  req: Request
): Promise<any> {
  // Extract and validate JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Authorization required to delete records');
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    throw new Error('Invalid or expired token');
  }

  // Find the record
  let record: any;
  if (request.recordId) {
    const { data, error } = await supabase
      .from('afroloc_records')
      .select('id, code, user_id, status')
      .eq('id', request.recordId)
      .single();
    if (error || !data) throw new Error('Record not found');
    record = data;
  } else if (request.code) {
    const { data, error } = await supabase
      .from('afroloc_records')
      .select('id, code, user_id, status')
      .eq('code', request.code)
      .single();
    if (error || !data) throw new Error('Record not found');
    record = data;
  } else {
    throw new Error('Delete requires recordId or code');
  }

  // Check admin role
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const adminRoles = ['admin', 'admin_national'];
  const isAdmin = roles?.some((r: any) => adminRoles.includes(r.role));

  // Authorization logic
  const isOwner = record.user_id === user.id;

  if (isAdmin) {
    // Admin can delete any record
  } else if (isOwner && record.status === 'draft') {
    // Owner can delete their own drafts
  } else if (isOwner) {
    throw new Error(`Only draft records can be deleted by the owner. Current status: ${record.status}`);
  } else {
    throw new Error('You do not have permission to delete this record');
  }

  // Manually delete dependent records to avoid storage trigger conflicts
  const dependentTables = [
    { table: 'witness_contract_downloads', column: 'afroloc_record_id' },
    { table: 'identity_documents', column: 'afroloc_record_id' },
    { table: 'afroloc_delivery_points', column: 'afroloc_record_id' },
    { table: 'afroloc_witnesses', column: 'afroloc_record_id' },
    { table: 'afroloc_validations', column: 'afroloc_record_id' },
    { table: 'afroloc_checkins', column: 'afroloc_record_id' },
    { table: 'afroloc_gps_history', column: 'afroloc_record_id' },
    { table: 'afroloc_record_versions', column: 'record_id' },
    { table: 'afroloc_residence_config', column: 'afroloc_record_id' },
    { table: 'afroloc_residents', column: 'afroloc_record_id' },
    { table: 'witness_reputation_history', column: 'afroloc_record_id' },
  ];

  for (const dep of dependentTables) {
    const { error } = await supabase.from(dep.table).delete().eq(dep.column, record.id);
    if (error) {
      console.warn(`Warning: failed to delete from ${dep.table}: ${error.message}`);
    }
  }

  // Set null on tables with SET NULL policy
  await supabase.from('afroloc_requests').update({ resulting_afroloc_id: null }).eq('resulting_afroloc_id', record.id);
  await supabase.from('violation_events').update({ afroloc_id: null }).eq('afroloc_id', record.id);
  await supabase.from('witness_fraud_flags').update({ afroloc_record_id: null }).eq('afroloc_record_id', record.id);
  await supabase.from('afroloc_resident_audit_log').update({ afroloc_record_id: null }).eq('afroloc_record_id', record.id);

  // Now delete the main record
  const { error: deleteError } = await supabase
    .from('afroloc_records')
    .delete()
    .eq('id', record.id);

  if (deleteError) {
    throw new Error(`Failed to delete record: ${deleteError.message}`);
  }

  // Audit log
  await logAudit(supabase, '', 'delete', user.id, true, {
    deletedRecordId: record.id,
    deletedCode: record.code,
    deletedStatus: record.status,
    deletedByRole: isAdmin ? 'admin' : 'owner',
  });

  return {
    deleted: true,
    recordId: record.id,
    code: record.code,
    deletedBy: isAdmin ? 'admin' : 'owner',
  };
}

/**
 * Log request to audit table
 */
async function logAudit(
  supabase: any,
  requestId: string,
  action: string,
  userId: string | null,
  success: boolean,
  details: any
): Promise<void> {
  try {
    await supabase.from('security_audit_log').insert({
      action: `gateway_${action}`,
      function_name: 'address-gateway',
      user_id: userId,
      details: {
        requestId,
        success,
        ...details,
      },
    });
  } catch (err) {
    console.error('Failed to log audit:', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const request: GatewayRequest = await req.json();
    
    console.log(`Gateway ${requestId}: Processing ${request.action} request`);

    // === Authentication: require a valid JWT for every action ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', requestId, timestamp }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token', requestId, timestamp }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load roles for authorization decisions
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const userRoles: string[] = (roleRows ?? []).map((r: any) => r.role);
    const isValidator = userRoles.some((r) =>
      ['admin', 'admin_national', 'admin_regional', 'validator', 'authority'].includes(r)
    );

    let result: any;
    let userId: string | null = user.id;
    
    switch (request.action) {
      case 'create':
        // Force authenticated user id — never trust client-supplied userId
        (request as any).userId = user.id;
        result = await handleCreate(request, supabase);
        break;
      case 'verify':
        result = await handleVerify(request, supabase);
        break;
      case 'certify':
        if (!isValidator) {
          return new Response(
            JSON.stringify({ success: false, error: 'Forbidden: validator role required', requestId, timestamp }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        (request as any).validatorId = user.id;
        result = await handleCertify(request, supabase);
        break;
      case 'lookup':
        result = await handleLookup(request, supabase);
        break;
      case 'list':
        result = await handleList(request, supabase);
        break;
      case 'validate':
        result = await handleValidate(request);
        break;
      case 'decode':
        result = await handleDecode(request);
        break;
      case 'delete':
        result = await handleDelete(request, supabase, req);
        userId = null; // already logged inside handleDelete
        break;
      default:
        throw new Error(`Unknown action: ${(request as any).action}`);
    }
    
    // Log successful request
    await logAudit(supabase, requestId, request.action, userId, true, { action: request.action });
    
    const response: GatewayResponse = {
      success: true,
      data: result,
      requestId,
      timestamp,
    };
    
    console.log(`Gateway ${requestId}: Success`);
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error(`Gateway ${requestId}: Error -`, error);

    const response: GatewayResponse = {
      success: false,
      error: (error as Error).message,
      requestId,
      timestamp,
    };
    
    return new Response(
      JSON.stringify(response),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
