// PoDP admin read — restricted to admin users with current_level >= 4.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

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
    const { data: claims, error: cErr } = await userClient.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    );
    if (cErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claims.claims.sub as string;

    const admin = createClient(url, service);
    const { data: lvl } = await admin
      .from('user_authorization_levels')
      .select('current_level')
      .eq('user_id', userId)
      .maybeSingle();
    if (!lvl || (lvl.current_level ?? 0) < 4) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const u = new URL(req.url);
    const recordId = u.searchParams.get('recordId');
    const details = u.searchParams.get('details') === '1';
    const cycleStart = u.searchParams.get('cycleStart');
    const cycleEnd = u.searchParams.get('cycleEnd');
    const limit = Math.min(Number(u.searchParams.get('limit') ?? 50), 500);

    let cyclesQ = admin.from('podp_cycles').select('*').order('cycle_end', { ascending: false }).limit(limit);
    if (recordId) cyclesQ = cyclesQ.eq('afroloc_record_id', recordId);
    const { data: cycles } = await cyclesQ;

    let dailyQ = admin.from('podp_daily_rollup').select('*').order('day', { ascending: false }).limit(limit);
    if (recordId) dailyQ = dailyQ.eq('afroloc_record_id', recordId);
    if (cycleStart) dailyQ = dailyQ.gte('day', cycleStart);
    if (cycleEnd) dailyQ = dailyQ.lte('day', cycleEnd);
    const { data: daily } = await dailyQ;

    let samples: unknown[] = [];
    let rejectionBreakdown: Record<string, number> = {};
    if (details && recordId) {
      let samplesQ = admin.from('podp_samples')
        .select('id, captured_at, received_at, geo_lat, geo_lon, accuracy_m, distance_from_address_m, is_within_radius, rejection_reason, device_fingerprint')
        .eq('afroloc_record_id', recordId)
        .order('captured_at', { ascending: false })
        .limit(Math.min(limit, 300));
      if (cycleStart) samplesQ = samplesQ.gte('captured_at', `${cycleStart}T00:00:00Z`);
      if (cycleEnd) samplesQ = samplesQ.lte('captured_at', `${cycleEnd}T23:59:59Z`);
      const { data: s } = await samplesQ;
      samples = s ?? [];

      // Aggregate rejection_reason
      let rejQ = admin.from('podp_samples')
        .select('rejection_reason')
        .eq('afroloc_record_id', recordId)
        .not('rejection_reason', 'is', null)
        .limit(2000);
      if (cycleStart) rejQ = rejQ.gte('captured_at', `${cycleStart}T00:00:00Z`);
      if (cycleEnd) rejQ = rejQ.lte('captured_at', `${cycleEnd}T23:59:59Z`);
      const { data: rej } = await rejQ;
      for (const r of rej ?? []) {
        const k = (r as { rejection_reason: string }).rejection_reason || 'unknown';
        rejectionBreakdown[k] = (rejectionBreakdown[k] ?? 0) + 1;
      }
    }

    await admin.from('security_audit_log').insert({
      action: 'podp_admin_read',
      function_name: 'podp-admin',
      user_id: userId,
      details: { recordId, limit, details, cycleStart, cycleEnd },
    }).catch(() => {});

    let address: { lat: number; lon: number } | null = null;
    if (details && recordId) {
      const { data: rec } = await admin
        .from('afroloc_records')
        .select('geo_lat, geo_lon')
        .eq('id', recordId)
        .maybeSingle();
      if (rec?.geo_lat != null && rec?.geo_lon != null) {
        address = { lat: Number(rec.geo_lat), lon: Number(rec.geo_lon) };
      }
    }

    return new Response(JSON.stringify({ cycles, daily, samples, rejectionBreakdown, address }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
