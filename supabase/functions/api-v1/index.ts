import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/auth_rbac.ts";

/**
 * AFROLOC Public REST API v1
 * 
 * Unified gateway with RESTful path routing:
 * 
 * ADDRESSES:
 *   GET    /addresses?code=XX          - Lookup by code
 *   GET    /addresses?lat=X&lon=Y      - Lookup by coordinates  
 *   GET    /addresses?country=AO       - List by country
 *   POST   /addresses                  - Create new address
 *   POST   /addresses/verify           - Verify address proximity
 *   POST   /addresses/decode           - Decode AFROLOC code
 *   POST   /addresses/normalize        - Normalize address text
 *   POST   /addresses/validate-code    - Validate AFROLOC code format
 * 
 * SCORES:
 *   POST   /scores/ats                 - Calculate ATS score
 *   GET    /scores/ats/:recordId       - Get ATS for record
 * 
 * VALIDATIONS:
 *   GET    /validations/:recordId      - Get validations for record
 *   POST   /validations/certify        - Certify an address
 * 
 * OTP:
 *   POST   /otp/send                   - Send OTP to phone number
 *   POST   /otp/verify                 - Verify OTP code
 * 
 * USERS:
 *   GET    /users/me                   - Get current user profile
 *   GET    /users/:id                  - Get user by ID (admin)
 *   GET    /users                      - List users (admin)
 * 
 * ZONES:
 *   POST   /zones/resolve              - Resolve urban/rural zone
 * 
 * META:
 *   GET    /                           - API info & health
 */

interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  requestId: string;
  timestamp: string;
  pagination?: { page: number; limit: number; total: number };
}

function generateRequestId(): string {
  return `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

function jsonRes(data: unknown, status = 200, requestId: string, pagination?: ApiResponse['pagination']): Response {
  const body: ApiResponse = {
    success: status < 400,
    data: status < 400 ? data : undefined,
    error: status >= 400 ? (data as string) : undefined,
    requestId,
    timestamp: new Date().toISOString(),
    pagination,
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errRes(message: string, status: number, requestId: string): Response {
  return jsonRes(message, status, requestId);
}

async function authenticate(req: Request, supabase: ReturnType<typeof createClient>): Promise<{ id: string; email: string; roles: string[] } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', data.user.id);

  return {
    id: data.user.id,
    email: data.user.email || '',
    roles: (rolesData || []).map((r: { role: string }) => r.role),
  };
}

function requireAuth(user: { id: string; email: string; roles: string[] } | null, requestId: string): Response | null {
  if (!user) return errRes('Authentication required. Provide a Bearer token.', 401, requestId);
  return null;
}

function requireAdmin(user: { id: string; email: string; roles: string[] }, requestId: string): Response | null {
  const adminRoles = ['admin', 'admin_national', 'admin_province', 'admin_municipality'];
  if (!user.roles.some(r => adminRoles.includes(r))) {
    return errRes('Forbidden. Admin role required.', 403, requestId);
  }
  return null;
}

function parsePath(url: URL): string[] {
  const fullPath = url.pathname;
  // Edge function path: /functions/v1/api-v1/...
  const match = fullPath.match(/\/api-v1\/(.*)/);
  if (!match || !match[1]) return [''];
  return match[1].split('/').filter(Boolean);
}

// ─── Route Handlers ──────────────────────────────────────

async function handleAddressesGet(
  url: URL,
  supabase: ReturnType<typeof createClient>,
  requestId: string,
): Promise<Response> {
  const code = url.searchParams.get('code');
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const country = url.searchParams.get('country');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = (page - 1) * limit;

  // Lookup by code
  if (code) {
    const { data: record, error } = await supabase
      .from('afroloc_records')
      .select('id, code, country, status, address_type, level1_name, level2_name, level3_name, level4_name, street_name, number, unit, property_type, geo_lat, geo_lon, created_at, last_verified_at')
      .eq('code', code)
      .single();

    if (error || !record) return errRes('Address not found', 404, requestId);
    return jsonRes(record, 200, requestId);
  }

  // Lookup by coordinates
  if (lat && lon) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    const radius = parseFloat(url.searchParams.get('radius') || '0.005'); // ~500m default

    const { data: records, error } = await supabase
      .from('afroloc_records')
      .select('id, code, country, status, level1_name, level2_name, level3_name, level4_name, street_name, number, geo_lat, geo_lon')
      .gte('geo_lat', latitude - radius)
      .lte('geo_lat', latitude + radius)
      .gte('geo_lon', longitude - radius)
      .lte('geo_lon', longitude + radius)
      .limit(limit);

    if (error) return errRes('Search failed', 500, requestId);

    // Sort by distance
    const sorted = (records || []).map((r: any) => {
      const dLat = (r.geo_lat - latitude) * 111000;
      const dLon = (r.geo_lon - longitude) * 111000;
      return { ...r, distance_meters: Math.round(Math.sqrt(dLat * dLat + dLon * dLon)) };
    }).sort((a: any, b: any) => a.distance_meters - b.distance_meters);

    return jsonRes(sorted, 200, requestId);
  }

  // List by country
  let query = supabase
    .from('afroloc_records')
    .select('id, code, country, status, level1_name, level2_name, level3_name, street_name, number, geo_lat, geo_lon, created_at', { count: 'exact' });

  if (country) query = query.eq('country', country.toUpperCase());

  const { data: records, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return errRes('List failed', 500, requestId);

  return jsonRes(records, 200, requestId, { page, limit, total: count || 0 });
}

async function handleAddressCreate(
  body: any,
  supabase: ReturnType<typeof createClient>,
  user: { id: string },
  requestId: string,
): Promise<Response> {
  if (!body.latitude || !body.longitude || !body.countryCode) {
    return errRes('latitude, longitude, and countryCode are required', 400, requestId);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Call QG Engine
  const qgRes = await fetch(`${supabaseUrl}/functions/v1/qg-engine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
    body: JSON.stringify({ latitude: body.latitude, longitude: body.longitude, countryCode: body.countryCode }),
  });
  if (!qgRes.ok) return errRes('QG Engine error', 502, requestId);
  const qgResult = await qgRes.json();

  // Call SQ Engine
  const sqRes = await fetch(`${supabaseUrl}/functions/v1/sq-engine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
    body: JSON.stringify({
      qgCode: qgResult.qgCode,
      latitude: body.latitude,
      longitude: body.longitude,
      cellBounds: qgResult.bounds,
      countryCode: body.countryCode,
    }),
  });
  if (!sqRes.ok) return errRes('SQ Engine error', 502, requestId);
  const sqResult = await sqRes.json();

  // Sequence
  const { count } = await supabase
    .from('afroloc_records')
    .select('*', { count: 'exact', head: true })
    .like('code', `${sqResult.fullCode}%`);

  const seq = ((count || 0) + 1).toString().padStart(4, '0');
  const afrolocCode = `${sqResult.fullCode}-${seq}`;

  const details = body.addressDetails || {};

  const { data: record, error: insertError } = await supabase
    .from('afroloc_records')
    .insert({
      code: afrolocCode,
      country: body.countryCode.toUpperCase(),
      user_id: user.id,
      geo_lat: body.latitude,
      geo_lon: body.longitude,
      level1_code: details.level1Code, level1_name: details.level1Name,
      level2_code: details.level2Code, level2_name: details.level2Name,
      level3_code: details.level3Code, level3_name: details.level3Name,
      level4_code: details.level4Code, level4_name: details.level4Name,
      street_name: details.streetName || body.streetName,
      number: details.number || body.number,
      unit: details.unit,
      property_type: details.propertyType || body.propertyType,
      photo_exif_gps_lat: body.photoMetadata?.exifLat,
      photo_exif_gps_lon: body.photoMetadata?.exifLon,
      photo_exif_timestamp: body.photoMetadata?.exifTimestamp,
      photo_exif_device_make: body.photoMetadata?.deviceMake,
      photo_exif_device_model: body.photoMetadata?.deviceModel,
      status: 'draft',
      metadata: { qgCode: qgResult.qgCode, sqCode: sqResult.sqCode, cellType: qgResult.cellType, createdVia: 'api-v1', requestId },
    })
    .select('id, code, country, status, created_at')
    .single();

  if (insertError) return errRes(`Failed to create: ${insertError.message}`, 500, requestId);

  return jsonRes({
    ...record,
    qgCode: qgResult.qgCode,
    sqCode: sqResult.sqCode,
    cellType: qgResult.cellType,
  }, 201, requestId);
}

async function handleAddressVerify(
  body: any,
  supabase: ReturnType<typeof createClient>,
  requestId: string,
): Promise<Response> {
  if (!body.afrolocCode || body.latitude === undefined || body.longitude === undefined) {
    return errRes('afrolocCode, latitude, and longitude are required', 400, requestId);
  }

  const { data: record, error } = await supabase
    .from('afroloc_records')
    .select('id, code, country, status, geo_lat, geo_lon, metadata, last_verified_at')
    .eq('code', body.afrolocCode)
    .single();

  if (error || !record) return errRes('Address not found', 404, requestId);

  const R = 6371000;
  const dLat = ((record as any).geo_lat - body.latitude) * Math.PI / 180;
  const dLon = ((record as any).geo_lon - body.longitude) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(body.latitude * Math.PI / 180) * Math.cos((record as any).geo_lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const isUrban = (record as any).metadata?.cellType === 'urban';
  const threshold = isUrban ? 100 : 500;
  const verified = distance <= threshold;

  if (verified) {
    await supabase.from('afroloc_records').update({ last_verified_at: new Date().toISOString() }).eq('id', (record as any).id);
  }

  return jsonRes({
    verified,
    distance_meters: Math.round(distance * 100) / 100,
    threshold_meters: threshold,
    cellType: isUrban ? 'urban' : 'rural',
    record: { code: (record as any).code, country: (record as any).country, status: (record as any).status },
  }, 200, requestId);
}

async function handleAddressDecode(body: any, requestId: string): Promise<Response> {
  if (!body.code) return errRes('code is required', 400, requestId);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const res = await fetch(`${supabaseUrl}/functions/v1/qg-engine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
    body: JSON.stringify({ code: body.code }),
  });

  if (!res.ok) return errRes('Decode failed', 502, requestId);
  return jsonRes(await res.json(), 200, requestId);
}

async function handleAddressNormalize(body: any, requestId: string): Promise<Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const res = await fetch(`${supabaseUrl}/functions/v1/normalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) return errRes('Normalize failed', 502, requestId);
  return jsonRes(await res.json(), 200, requestId);
}

async function handleATSScore(
  body: any,
  supabase: ReturnType<typeof createClient>,
  requestId: string,
): Promise<Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const res = await fetch(`${supabaseUrl}/functions/v1/ats-engine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
    body: JSON.stringify({
      afroidRecordId: body.afrolocRecordId || body.recordId,
      afrolocCode: body.afrolocCode,
    }),
  });

  if (!res.ok) return errRes('ATS computation failed', 502, requestId);
  return jsonRes(await res.json(), 200, requestId);
}

async function handleATSGet(
  recordId: string,
  requestId: string,
): Promise<Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const res = await fetch(`${supabaseUrl}/functions/v1/ats-engine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
    body: JSON.stringify({ afroidRecordId: recordId }),
  });

  if (!res.ok) return errRes('ATS computation failed', 502, requestId);
  return jsonRes(await res.json(), 200, requestId);
}

async function handleValidationsGet(
  recordId: string,
  supabase: ReturnType<typeof createClient>,
  requestId: string,
): Promise<Response> {
  const { data, error } = await supabase
    .from('afroloc_validations')
    .select('*')
    .eq('afroloc_record_id', recordId)
    .order('created_at', { ascending: false });

  if (error) return errRes('Failed to fetch validations', 500, requestId);
  return jsonRes(data, 200, requestId);
}

async function handleCertify(
  body: any,
  supabase: ReturnType<typeof createClient>,
  user: { id: string },
  requestId: string,
): Promise<Response> {
  if (!body.recordId || !body.level) {
    return errRes('recordId and level (1-4) are required', 400, requestId);
  }

  const level = parseInt(body.level);
  if (level < 1 || level > 4) return errRes('level must be between 1 and 4', 400, requestId);

  const { data: validation, error } = await supabase
    .from('afroloc_validations')
    .insert({
      afroloc_record_id: body.recordId,
      validation_method: `certification_level_${level}`,
      authority_role: 'certified_validator',
      authority_signature: user.id,
      notes: body.notes || null,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (error) return errRes(`Certification failed: ${error.message}`, 500, requestId);

  const newStatus = level >= 3 ? 'certified' : 'verified';
  await supabase
    .from('afroloc_records')
    .update({ status: newStatus, approved_at: new Date().toISOString(), approved_by_user_id: user.id, last_verified_at: new Date().toISOString() })
    .eq('id', body.recordId);

  return jsonRes({ ...validation, newStatus }, 201, requestId);
}

async function handleUsersMe(
  supabase: ReturnType<typeof createClient>,
  user: { id: string; email: string; roles: string[] },
  requestId: string,
): Promise<Response> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const { data: level } = await supabase
    .from('user_authorization_levels')
    .select('current_level, total_points')
    .eq('user_id', user.id)
    .single();

  return jsonRes({
    id: user.id,
    email: user.email,
    roles: user.roles,
    profile: profile || null,
    authorization: level || null,
  }, 200, requestId);
}

async function handleUsersList(
  url: URL,
  supabase: ReturnType<typeof createClient>,
  requestId: string,
): Promise<Response> {
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const search = url.searchParams.get('search');
  const offset = (page - 1) * limit;

  let query = supabase
    .from('profiles')
    .select('user_id, full_name, phone, country_code, created_at, onboarding_completed', { count: 'exact' });

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return errRes('Failed to list users', 500, requestId);
  return jsonRes(data, 200, requestId, { page, limit, total: count || 0 });
}

async function handleZoneResolve(body: any, requestId: string): Promise<Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const res = await fetch(`${supabaseUrl}/functions/v1/resolve-zone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) return errRes('Zone resolve failed', 502, requestId);
  return jsonRes(await res.json(), 200, requestId);
}

async function handleOTPSend(body: any, requestId: string): Promise<Response> {
  if (!body.phone) return errRes('phone is required (format: +244923XXXXXX)', 400, requestId);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const res = await fetch(`${supabaseUrl}/functions/v1/send-signup-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
    body: JSON.stringify({ phone: body.phone }),
  });

  const data = await res.json();
  if (!res.ok) return errRes(data.error || 'Failed to send OTP', res.status, requestId);
  return jsonRes({ message: 'OTP sent successfully', phone: body.phone }, 200, requestId);
}

async function handleOTPVerify(body: any, requestId: string): Promise<Response> {
  if (!body.phone || !body.otp_code) return errRes('phone and otp_code are required', 400, requestId);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const res = await fetch(`${supabaseUrl}/functions/v1/verify-signup-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
    body: JSON.stringify({ phone: body.phone, otp_code: body.otp_code }),
  });

  const data = await res.json();
  if (!res.ok) return errRes(data.error || 'OTP verification failed', res.status, requestId);
  return jsonRes({ verified: true, phone: body.phone }, 200, requestId);
}

// ─── Main Router ─────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = generateRequestId();
  const url = new URL(req.url);
  const segments = parsePath(url);
  const method = req.method;

  console.log(`[api-v1] ${method} /${segments.join('/')} (${requestId})`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const user = await authenticate(req, supabase);

    const resource = segments[0] || '';
    const subResource = segments[1] || '';
    const param = segments[2] || '';

    // ─── GET / ─── API Info
    if (resource === '' && method === 'GET') {
      return jsonRes({
        name: 'AFROLOC Public API',
        version: 'v1',
        documentation: `${supabaseUrl}/functions/v1/api-v1/`,
        endpoints: {
          addresses: 'GET/POST /addresses',
          scores: 'GET/POST /scores/ats',
          validations: 'GET/POST /validations',
          otp: 'POST /otp/send, POST /otp/verify',
          users: 'GET /users',
          zones: 'POST /zones/resolve',
        },
        status: 'operational',
      }, 200, requestId);
    }

    // ─── ADDRESSES ───
    if (resource === 'addresses') {
      if (method === 'GET') {
        return handleAddressesGet(url, supabase, requestId);
      }
      if (method === 'POST') {
        const body = await req.json();
        if (subResource === 'verify') {
          const authErr = requireAuth(user, requestId);
          if (authErr) return authErr;
          return handleAddressVerify(body, supabase, requestId);
        }
        if (subResource === 'decode') {
          return handleAddressDecode(body, requestId);
        }
        if (subResource === 'normalize') {
          return handleAddressNormalize(body, requestId);
        }
        if (subResource === 'validate-code') {
          const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
          const res = await fetch(`${supabaseUrl}/functions/v1/qg-engine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ action: 'validate', code: body.code }),
          });
          if (!res.ok) return errRes('Validation failed', 502, requestId);
          return jsonRes(await res.json(), 200, requestId);
        }
        // Default POST = create
        const authErr = requireAuth(user, requestId);
        if (authErr) return authErr;
        return handleAddressCreate(body, supabase, user!, requestId);
      }
    }

    // ─── SCORES ───
    if (resource === 'scores') {
      const authErr = requireAuth(user, requestId);
      if (authErr) return authErr;
      if (subResource === 'ats') {
        if (method === 'GET' && param) {
          return handleATSGet(param, requestId);
        }
        if (method === 'POST') {
          const body = await req.json();
          return handleATSScore(body, supabase, requestId);
        }
      }
    }

    // ─── VALIDATIONS ───
    if (resource === 'validations') {
      const authErr = requireAuth(user, requestId);
      if (authErr) return authErr;
      if (subResource === 'certify' && method === 'POST') {
        const adminErr = requireAdmin(user!, requestId);
        if (adminErr) return adminErr;
        const body = await req.json();
        return handleCertify(body, supabase, user!, requestId);
      }
      if (subResource && method === 'GET') {
        return handleValidationsGet(subResource, supabase, requestId);
      }
    }

    // ─── OTP ───
    if (resource === 'otp' && method === 'POST') {
      const body = await req.json();
      if (subResource === 'send') {
        return handleOTPSend(body, requestId);
      }
      if (subResource === 'verify') {
        return handleOTPVerify(body, requestId);
      }
    }

    // ─── USERS ───
    if (resource === 'users') {
      const authErr = requireAuth(user, requestId);
      if (authErr) return authErr;
      if (subResource === 'me' && method === 'GET') {
        return handleUsersMe(supabase, user!, requestId);
      }
      if (method === 'GET' && !subResource) {
        const adminErr = requireAdmin(user!, requestId);
        if (adminErr) return adminErr;
        return handleUsersList(url, supabase, requestId);
      }
      if (subResource && method === 'GET') {
        const adminErr = requireAdmin(user!, requestId);
        if (adminErr) return adminErr;
        const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', subResource).single();
        if (!profile) return errRes('User not found', 404, requestId);
        return jsonRes(profile, 200, requestId);
      }
    }

    // ─── ZONES ───
    if (resource === 'zones') {
      if (subResource === 'resolve' && method === 'POST') {
        const body = await req.json();
        return handleZoneResolve(body, requestId);
      }
    }

    return errRes(`Route not found: ${method} /${segments.join('/')}`, 404, requestId);

  } catch (error: unknown) {
    console.error(`[api-v1] Error (${requestId}):`, error);
    const msg = error instanceof Error ? error.message : 'Internal server error';

    if (msg.includes('Missing Bearer') || msg.includes('Invalid or expired')) {
      return errRes(msg, 401, requestId);
    }
    return errRes(msg, 500, requestId);
  }
});
