// PoDP — Proof of Daily Presence: receive GPS samples from the holder's device.
// Silent endpoint. The holder cannot read their own samples.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_BATCH = 50;
const MAX_DAILY_SAMPLES = 200;

interface SampleIn {
  clientGeneratedId: string;
  afrolocRecordId: string;
  lat: number;
  lon: number;
  accuracy?: number;
  capturedAt: string; // ISO
  deviceFingerprint?: string;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimErr } = await userClient.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    );
    if (claimErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json();
    const samples: SampleIn[] = Array.isArray(body?.samples) ? body.samples : [];
    if (samples.length === 0 || samples.length > MAX_BATCH) {
      return new Response(JSON.stringify({ error: `samples must be 1..${MAX_BATCH}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(url, service);

    // Load config (global)
    const { data: cfg } = await admin
      .from('podp_config')
      .select('*')
      .eq('scope', 'global')
      .maybeSingle();
    const config = cfg ?? {
      tolerance_radius_urban_m: 75,
      tolerance_radius_rural_m: 250,
      max_gps_accuracy_m: 100,
      enabled: true,
    };
    if (!config.enabled) {
      return new Response(JSON.stringify({ accepted: 0, disabled: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Daily rate limit
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: dailyCount } = await admin
      .from('podp_samples')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('received_at', since);
    if ((dailyCount ?? 0) >= MAX_DAILY_SAMPLES) {
      return new Response(JSON.stringify({ error: 'daily_rate_limit' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch unique records once
    const recordIds = [...new Set(samples.map((s) => s.afrolocRecordId))];
    const { data: records } = await admin
      .from('afroloc_records')
      .select('id, user_id, geo_lat, geo_lon, metadata')
      .in('id', recordIds);
    const recordMap = new Map((records ?? []).map((r: any) => [r.id, r]));

    const rows: any[] = [];
    let rejected = 0;

    for (const s of samples) {
      const rec = recordMap.get(s.afrolocRecordId);
      if (!rec || rec.user_id !== userId) { rejected++; continue; }

      // Anti-spoofing: precision of coordinates
      const latDec = (s.lat.toString().split('.')[1] || '').length;
      const lonDec = (s.lon.toString().split('.')[1] || '').length;
      let reject: string | null = null;
      if (latDec < 4 || lonDec < 4) reject = 'low_precision';
      if (s.accuracy != null && s.accuracy > config.max_gps_accuracy_m) reject = 'low_accuracy';

      const distance = haversine(rec.geo_lat, rec.geo_lon, s.lat, s.lon);
      const isUrban =
        (rec.metadata as any)?.cellType === 'urban' ||
        (rec.metadata as any)?.subdivisionType === 'urban';
      const radius = isUrban ? config.tolerance_radius_urban_m : config.tolerance_radius_rural_m;
      const within = !reject && distance <= radius;

      rows.push({
        user_id: userId,
        afroloc_record_id: s.afrolocRecordId,
        geo_lat: s.lat,
        geo_lon: s.lon,
        accuracy_m: s.accuracy ?? null,
        distance_from_address_m: Math.round(distance * 100) / 100,
        is_within_radius: within,
        captured_at: s.capturedAt,
        device_fingerprint: s.deviceFingerprint ?? null,
        client_generated_id: s.clientGeneratedId,
        rejection_reason: reject,
      });
    }

    let accepted = 0;
    if (rows.length > 0) {
      const { data, error } = await admin
        .from('podp_samples')
        .upsert(rows, { onConflict: 'user_id,client_generated_id', ignoreDuplicates: true })
        .select('id');
      if (error) throw error;
      accepted = data?.length ?? 0;
    }

    return new Response(
      JSON.stringify({ accepted, rejected, received: samples.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('podp-sample error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
