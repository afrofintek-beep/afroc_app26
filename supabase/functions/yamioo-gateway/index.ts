import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/auth_rbac.ts";
import { normalizeAfrolocCode, codeForms, encodeAfroloc } from "../_shared/afroloc_code.ts";

/**
 * Yamioo Integration Gateway
 *
 * AFROLOC code format (canónico, SEM prefixos X/Y — formas com prefixo
 * são aceites e normalizadas; validação ÚNICA em _shared/afroloc_code.ts):
 *   Standard:      AO-ZU-G10-35O8-N247T
 *   Nomenclature:  AO-LUA-BEL-TAL-G10-35O8-N247T
 *
 * Endpoints:
 * - POST ?action=lookup       → Lookup by AFROLOC code or GPS
 * - POST ?action=lookup_batch → Batch encode (requer x-partner-key)
 * - POST ?action=verify       → Verify delivery proximity
 * - POST ?action=subscribe    → Subscribe to webhook events
 * - GET  ?action=status       → Health check
 */

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
          version: '2.1.0',
          code_format: {
            standard: 'CC-ZT-Gnn-xxxx-yyyy',
            nomenclature: 'CC-PROV-MUN[-COM[-BAI]]-Gnn-xxxx-yyyy',
            coordinate_codec: 'base36 uppercase, prefixo N para negativos; prefixos X/Y tolerados na entrada',
            examples: [
              'AO-ZU-G10-35O8-N247T',
              'AO-LUA-BEL-TAL-CAM-G10-35O8-N247T',
              'AO-ZU-G10-X35O8-YN247T (aceite, normalizado sem prefixos)',
            ],
          },
          endpoints: ['lookup', 'lookup_batch', 'verify', 'subscribe', 'status', 'share', 'resolve', 'revoke', 'history', 'plan_get', 'plan_set'],
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

          // Registos históricos podem ter sido gravados com prefixos X/Y —
          // procurar por ambas as formas equivalentes do código.
          const { data: rows, error: dbError } = await supabase
            .from('afroloc_records')
            .select('code, country, status, geo_lat, geo_lon, level1_name, level2_name, level3_name, level4_name, street_name, number, address_type, property_type')
            .in('code', codeForms(validation.normalized))
            .limit(1);

          if (dbError) {
            console.error('[yamioo] lookup db error:', dbError);
            return error('Database error', 500);
          }
          const data = rows?.[0];
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

        return error('Provide "code" (format: CC-ZU-G10-xxxx-yyyy) or "latitude"+"longitude"', 400);
      }

      // ── LOOKUP BATCH (pipeline de importação: gera códigos em lote, em processo) ──
      // Requer chave de parceiro: header x-partner-key ∈ env AFROLOC_PARTNER_KEYS
      // (lista separada por vírgulas). Sem a env definida, a ação fica desativada.
      // Ao contrário do lookup 1:1, NÃO faz fetch ao qg-engine — codifica em
      // processo via _shared/afroloc_code.ts (mesma implementação). A SQ fica
      // deliberadamente fora deste caminho (COUNT+escritas por ponto não escala).
      case 'lookup_batch': {
        if (req.method !== 'POST') return error('POST required', 405);

        const partnerKeys = (Deno.env.get('AFROLOC_PARTNER_KEYS') ?? '')
          .split(',').map((k) => k.trim()).filter(Boolean);
        if (partnerKeys.length === 0) {
          return error('lookup_batch is not enabled (AFROLOC_PARTNER_KEYS not configured)', 503);
        }
        const providedKey = req.headers.get('x-partner-key') ?? '';
        if (!providedKey || !partnerKeys.includes(providedKey)) {
          return error('unauthorized: valid x-partner-key required', 401);
        }

        const body = await req.json();
        const points = body?.points;
        if (!Array.isArray(points) || points.length === 0) {
          return error('Provide "points": [{latitude, longitude, countryCode, ...}]', 400);
        }
        const MAX_BATCH = 500;
        if (points.length > MAX_BATCH) {
          return error(`Batch too large: max ${MAX_BATCH} points per request`, 413);
        }

        const results = points.map((p: any) => {
          const ref = p?.ref ?? null;
          try {
            const lat = Number(p?.latitude);
            const lon = Number(p?.longitude);
            if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
              return { ref, ok: false, error: 'Invalid latitude' };
            }
            if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
              return { ref, ok: false, error: 'Invalid longitude' };
            }
            const cc = String(p?.countryCode ?? body?.countryCode ?? '').toUpperCase();
            if (!/^[A-Z]{2}$/.test(cc)) {
              return { ref, ok: false, error: 'Invalid countryCode' };
            }
            const r = encodeAfroloc({
              latitude: lat,
              longitude: lon,
              countryCode: cc,
              cellType: p?.cellType,
              adminPath: p?.adminPath,
              provinceCode: p?.provinceCode,
              municipalityCode: p?.municipalityCode,
              communeCode: p?.communeCode,
              neighborhoodCode: p?.neighborhoodCode,
              registrationType: p?.registrationType,
            });
            return {
              ref,
              ok: true,
              afroloc: r.afroloc,
              afrolocLegacy: r.afrolocLegacy,
              zone: r.zone,
              grid_m: r.grid_m,
              centroid: r.centroid,
              bbox: r.bbox,
            };
          } catch (e) {
            return { ref, ok: false, error: (e as Error)?.message ?? 'encode failed' };
          }
        });

        const okCount = results.filter((r: { ok: boolean }) => r.ok).length;
        return json({ count: results.length, ok: okCount, failed: results.length - okCount, results });
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

        const { data: vRows, error: dbError } = await supabase
          .from('afroloc_records')
          .select('id, geo_lat, geo_lon, status, address_type')
          .in('code', codeForms(validation.normalized))
          .limit(1);

        if (dbError) {
          console.error('[yamioo] verify db error:', dbError);
          return error('Database error', 500);
        }
        const record = vRows?.[0];
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

      // ── PRIVACIDADE · SHARE (o dono cria um token de acesso a um endereço privado) ──
      case 'share': {
        if (req.method !== 'POST') return error('POST required', 405);
        const { code, lat, lng, owner_ref, app: appOrigin, scope, ttl_minutes, label, purpose } = await req.json();
        if (!code || lat == null || lng == null || !owner_ref) return error('code, lat, lng, owner_ref required', 400);
        const v = normalizeAfrolocCode(code);
        if (!v.valid) return error(v.error || 'invalid AFROLOC code', 400);
        // Clamp autoritário da duração pelo PLANO. O AFROLOC é a AUTORIDADE: o tier é
        // lido do registo central (afl_owner_plans) pelo owner_ref, NÃO da alegação do
        // cliente. Assim o mesmo tier vale em qualquer app. Ver docs/planos.md.
        const PLAN_MAX_TTL: Record<string, number | null> = { gratis: 1440, pro: 43200, negocio: null };
        const { data: planRow } = await supabase.from('afl_owner_plans')
          .select('plan').eq('owner_ref', owner_ref).maybeSingle();
        const plan = planRow?.plan ?? 'gratis';
        const maxTtl = plan in PLAN_MAX_TTL ? PLAN_MAX_TTL[plan] : PLAN_MAX_TTL.gratis;
        const reqTtl = ttl_minutes ?? null;
        const effTtl = maxTtl == null ? reqTtl : (reqTtl == null ? maxTtl : Math.min(reqTtl, maxTtl));
        const { data: addr, error: aErr } = await supabase.from('afl_addresses')
          .upsert({ code: v.normalized, owner_ref, app: appOrigin ?? null, lat, lng, label: label ?? null }, { onConflict: 'owner_ref,code' })
          .select('id').single();
        if (aErr || !addr) { console.error('[afl] share addr', aErr); return error('failed to register address', 500); }
        const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        const expires_at = effTtl ? new Date(Date.now() + effTtl * 60000).toISOString() : null;
        const scp = scope === 'zone' ? 'zone' : 'coordinate';
        const { error: gErr } = await supabase.from('afl_grants')
          .insert({ address_id: addr.id, token, scope: scp, label: label ?? null, purpose: purpose ?? null, expires_at });
        if (gErr) { console.error('[afl] share grant', gErr); return error('failed to create grant', 500); }
        return json({ token, scope: scp, expires_at });
      }

      // ── PRIVACIDADE · RESOLVE (por token = capacidade; app-agnóstico; auditado) ──
      case 'resolve': {
        if (req.method !== 'POST') return error('POST required', 405);
        const { token, caller_ref } = await req.json();
        if (!token) return error('token required', 400);
        const { data: g } = await supabase.from('afl_grants')
          .select('id, address_id, scope, revoked, expires_at').eq('token', token).maybeSingle();
        if (!g || g.revoked || (g.expires_at && new Date(g.expires_at) < new Date())) return json({ granted: false });
        const { data: addr } = await supabase.from('afl_addresses')
          .select('lat, lng, code, privacy').eq('id', g.address_id).maybeSingle();
        if (!addr) return json({ granted: false });
        await supabase.from('afl_resolutions').insert({ address_id: g.address_id, via: 'token', caller_ref: caller_ref ?? null });
        if (g.scope === 'zone') return json({ granted: true, scope: 'zone', code: addr.code });
        return json({ granted: true, scope: 'coordinate', lat: addr.lat, lng: addr.lng, code: addr.code });
      }

      // ── PRIVACIDADE · REVOKE (o dono revoga um token) ──
      case 'revoke': {
        if (req.method !== 'POST') return error('POST required', 405);
        const { token, owner_ref } = await req.json();
        if (!token || !owner_ref) return error('token, owner_ref required', 400);
        const { data: g } = await supabase.from('afl_grants').select('id, address_id').eq('token', token).maybeSingle();
        if (!g) return json({ revoked: false });
        const { data: addr } = await supabase.from('afl_addresses').select('owner_ref').eq('id', g.address_id).maybeSingle();
        if (!addr || addr.owner_ref !== owner_ref) return error('not owner', 403);
        await supabase.from('afl_grants').update({ revoked: true }).eq('id', g.id);
        return json({ revoked: true });
      }

      // ── PRIVACIDADE · HISTORY (o dono vê a auditoria dos seus endereços) ──
      case 'history': {
        if (req.method !== 'POST') return error('POST required', 405);
        const { owner_ref } = await req.json();
        if (!owner_ref) return error('owner_ref required', 400);
        const { data: addrs } = await supabase.from('afl_addresses').select('id, code, label').eq('owner_ref', owner_ref);
        const ids = (addrs ?? []).map((a: any) => a.id);
        let resolutions: any[] = [];
        let grants: any[] = [];
        if (ids.length) {
          const { data: rs } = await supabase.from('afl_resolutions')
            .select('address_id, via, caller_ref, created_at').in('address_id', ids)
            .order('created_at', { ascending: false }).limit(100);
          resolutions = rs ?? [];
          const { data: gs } = await supabase.from('afl_grants')
            .select('id, address_id, token, scope, label, purpose, expires_at, revoked, created_at').in('address_id', ids)
            .order('created_at', { ascending: false });
          grants = gs ?? [];
        }
        return json({ addresses: addrs ?? [], resolutions, grants });
      }

      // ── PLANOS · GET (o tier central do owner_ref; leitura pública, não sensível) ──
      case 'plan_get': {
        if (req.method !== 'POST') return error('POST required', 405);
        const { owner_ref } = await req.json();
        if (!owner_ref) return error('owner_ref required', 400);
        const { data } = await supabase.from('afl_owner_plans')
          .select('plan').eq('owner_ref', owner_ref).maybeSingle();
        return json({ owner_ref, plan: data?.plan ?? 'gratis' });
      }

      // ── PLANOS · SET (autoridade central; SÓ via segredo de servidor, nunca do browser) ──
      case 'plan_set': {
        if (req.method !== 'POST') return error('POST required', 405);
        const adminSecret = Deno.env.get('AFROLOC_ADMIN_SECRET');
        const provided = req.headers.get('x-admin-secret');
        if (!adminSecret || provided !== adminSecret) return error('unauthorized', 401);
        const { owner_ref, plan, updated_by } = await req.json();
        if (!owner_ref || !['gratis', 'pro', 'negocio'].includes(plan)) {
          return error('owner_ref + valid plan (gratis|pro|negocio) required', 400);
        }
        const { error: uErr } = await supabase.from('afl_owner_plans')
          .upsert({ owner_ref, plan, updated_at: new Date().toISOString(), updated_by: updated_by ?? null }, { onConflict: 'owner_ref' });
        if (uErr) { console.error('[afl] plan_set', uErr); return error('failed to set plan', 500); }
        return json({ owner_ref, plan });
      }

      default:
        return error(`Unknown action: ${action}. Valid actions: lookup, lookup_batch, verify, subscribe, status, share, resolve, revoke, history, plan_get, plan_set`, 400);
    }
  } catch (err) {
    console.error('[yamioo] Error:', err);
    return error('Internal server error', 500);
  }
});
