import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/auth_rbac.ts";

/**
 * Yamioo Integration Gateway
 * 
 * AFROLOC code format: CC-ZT-Gnn-Xxxxx-Yyyyy
 *   Standard:      AO-ZU-G10-X35O8-YN247T
 *   Nomenclature:  AO-LUA-BEL-TAL-G10-X35O8-YN247T
 * 
 * Endpoints:
 * - POST ?action=lookup    → Lookup by AFROLOC code or GPS
 * - POST ?action=verify    → Verify delivery proximity
 * - POST ?action=subscribe → Subscribe to webhook events
 * - GET  ?action=status    → Health check
 */

// ── AFROLOC Code Patterns ──
const STANDARD_PATTERN = /^([A-Z]{2})-(Z[UR])-(G\d+)-X([A-Z0-9N]+)-Y([A-Z0-9N]+)$/;
const NOMENCLATURE_PATTERN = /^([A-Z]{2})-([A-Z]{2,4})-([A-Z]{2,4})-([A-Z]{2,4})-(?:([A-Z]{2,4})-)?(G\d+)-X?([A-Z0-9N]+)-Y?([A-Z0-9N]+)$/;

function normalizeAfrolocCode(code: string): { valid: boolean; normalized: string; error?: string } {
  if (!code || typeof code !== 'string') {
    return { valid: false, normalized: '', error: 'Code is required' };
  }
  const trimmed = code.trim().toUpperCase();

  if (STANDARD_PATTERN.test(trimmed)) {
    return { valid: true, normalized: trimmed };
  }
  if (NOMENCLATURE_PATTERN.test(trimmed)) {
    return { valid: true, normalized: trimmed };
  }

  // Legacy: old zone tags (URBAN/RURAL)
  const oldZone = trimmed.match(/^([A-Z]{2})-(URBAN|RURAL)-(G\d+)-X([A-Z0-9N]+)-Y([A-Z0-9N]+)$/);
  if (oldZone) {
    const [, cc, zone, gt, x, y] = oldZone;
    const zt = zone === 'URBAN' ? 'ZU' : 'ZR';
    return { valid: true, normalized: `${cc}-${zt}-${gt}-X${x}-Y${y}` };
  }

  return { valid: false, normalized: '', error: `Unrecognized AFROLOC code format: ${code}. Expected: CC-ZU-G10-Xxxxx-Yyyyy or CC-PROV-MUN-COM-G10-Xxxxx-Yyyyy` };
}

// ── Haversine distance ──
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Hash secret ──
async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Response helpers ──
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function error(message: string, status: number) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'status';

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    switch (action) {
      // ── STATUS ──
      case 'status': {
        return json({
          status: 'operational',
          partner: 'yamioo',
          version: '2.0.0',
          code_format: {
            standard: 'CC-ZT-Gnn-Xxxxx-Yyyyy',
            nomenclature: 'CC-PROV-MUN-COM-BAI-Gnn-Xxxxx-Yyyyy',
            examples: [
              'AO-ZU-G10-X35O8-YN247T',
              'AO-LUA-BEL-TAL-CAM-G10-X35O8-YN247T',
            ],
          },
          endpoints: ['lookup', 'verify', 'subscribe', 'status'],
          timestamp: new Date().toISOString(),
        });
      }

      // ── LOOKUP ──
      case 'lookup': {
        if (req.method !== 'POST') return error('POST required', 405);

        const body = await req.json();
        const { code, latitude, longitude, countryCode } = body;

        if (code) {
          // Validate AFROLOC code format
          const validation = normalizeAfrolocCode(code);
          if (!validation.valid) {
            return error(validation.error || 'Invalid AFROLOC code format', 400);
          }

          const { data, error: dbError } = await supabase
            .from('afroloc_records')
            .select('code, country, status, geo_lat, geo_lon, level1_name, level2_name, level3_name, level4_name, street_name, number, address_type, property_type')
            .eq('code', validation.normalized)
            .maybeSingle();

          if (dbError) {
            console.error('[yamioo] lookup db error:', dbError);
            return error('Database error', 500);
          }
          if (!data) return error('Address not found', 404);

          return json({
            found: true,
            address: {
              code: data.code,
              country: data.country,
              status: data.status,
              type: data.address_type,
              coordinates: { lat: data.geo_lat, lon: data.geo_lon },
              hierarchy: {
                province: data.level1_name,
                municipality: data.level2_name,
                commune: data.level3_name,
                neighborhood: data.level4_name,
              },
              street: data.street_name ? `${data.street_name}${data.number ? ` ${data.number}` : ''}` : null,
              property_type: data.property_type,
            },
          });
        }

        if (latitude != null && longitude != null) {
          const resolveResp = await fetch(`${supabaseUrl}/functions/v1/qg-engine`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ latitude, longitude, countryCode: countryCode || 'AO' }),
          });

          if (!resolveResp.ok) {
            const errText = await resolveResp.text();
            return error(`Resolution failed: ${errText}`, 502);
          }

          const resolved = await resolveResp.json();
          return json({ found: true, resolved });
        }

        return error('Provide "code" (format: CC-ZU-G10-Xxxxx-Yyyyy) or "latitude"+"longitude"', 400);
      }

      // ── VERIFY ──
      case 'verify': {
        if (req.method !== 'POST') return error('POST required', 405);

        const body = await req.json();
        const { code, latitude, longitude } = body;

        if (!code || latitude == null || longitude == null) {
          return error('Required: code, latitude, longitude', 400);
        }

        // Validate AFROLOC code format
        const validation = normalizeAfrolocCode(code);
        if (!validation.valid) {
          return error(validation.error || 'Invalid AFROLOC code format', 400);
        }

        const { data: record, error: dbError } = await supabase
          .from('afroloc_records')
          .select('id, geo_lat, geo_lon, status, address_type')
          .eq('code', validation.normalized)
          .maybeSingle();

        if (dbError) {
          console.error('[yamioo] verify db error:', dbError);
          return error('Database error', 500);
        }
        if (!record) return error('Address not found', 404);

        if (record.geo_lat == null || record.geo_lon == null) {
          return error('Address has no GPS coordinates registered', 422);
        }

        const dist = haversine(latitude, longitude, record.geo_lat, record.geo_lon);
        // Threshold: 150m formal/urban, 500m informal/rural
        const threshold = record.address_type === 'formal' ? 150 : 500;
        const verified = dist <= threshold;

        return json({
          verified,
          distance_m: Math.round(dist * 10) / 10,
          threshold_m: threshold,
          status: record.status,
          address_type: record.address_type,
        });
      }

      // ── SUBSCRIBE ──
      case 'subscribe': {
        if (req.method !== 'POST') return error('POST required', 405);

        const body = await req.json();
        const { webhook_url, events, secret } = body;

        if (!webhook_url || !events || !secret) {
          return error('Required: webhook_url, events, secret', 400);
        }

        const validEvents = [
          'address.created', 'address.status_changed', 'address.verified',
          'checkin.completed', 'witness.confirmed', 'resident.approved',
        ];
        const invalidEvents = events.filter((e: string) => !validEvents.includes(e));
        if (invalidEvents.length > 0) {
          return error(`Invalid events: ${invalidEvents.join(', ')}. Valid: ${validEvents.join(', ')}`, 400);
        }

        const { data: sub, error: subError } = await supabase
          .from('webhook_subscriptions')
          .insert({
            name: 'yamioo',
            url: webhook_url,
            events,
            secret: await hashSecret(secret),
            is_active: true,
            metadata: { partner: 'yamioo', created_via: 'yamioo-gateway' },
          })
          .select('id')
          .single();

        if (subError) {
          console.error('[yamioo] Subscribe error:', subError);
          return error('Failed to create subscription', 500);
        }

        return json({
          subscription_id: sub?.id,
          events,
          status: 'active',
        }, 201);
      }

      default:
        return error(`Unknown action: ${action}. Valid actions: lookup, verify, subscribe, status`, 400);
    }
  } catch (err) {
    console.error('[yamioo] Error:', err);
    return error('Internal server error', 500);
  }
});
