// PoDP — daily rollup + cycle closure. Invoked by pg_cron once per day.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, service);

    const { data: cfg } = await admin
      .from('podp_config')
      .select('*')
      .eq('scope', 'global')
      .maybeSingle();
    if (!cfg || !cfg.enabled) {
      return new Response(JSON.stringify({ skipped: 'disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const sampleMin = cfg.sample_interval_minutes;
    const minHours = Number(cfg.min_hours_per_day);
    const cycleDays = cfg.cycle_length_days;

    // Yesterday's UTC date
    const now = new Date();
    const yest = new Date(now.getTime() - 24 * 3600 * 1000);
    const dayStr = yest.toISOString().slice(0, 10);
    const dayStart = new Date(`${dayStr}T00:00:00Z`).toISOString();
    const dayEnd = new Date(`${dayStr}T23:59:59.999Z`).toISOString();

    // Aggregate valid samples per (user, record) for yesterday
    const { data: samples, error: sErr } = await admin
      .from('podp_samples')
      .select('user_id, afroloc_record_id')
      .eq('is_within_radius', true)
      .gte('captured_at', dayStart)
      .lte('captured_at', dayEnd);
    if (sErr) throw sErr;

    const counts = new Map<string, { user_id: string; afroloc_record_id: string; n: number }>();
    for (const s of samples ?? []) {
      const k = `${s.user_id}|${s.afroloc_record_id}`;
      const cur = counts.get(k);
      if (cur) cur.n++;
      else counts.set(k, { user_id: s.user_id, afroloc_record_id: s.afroloc_record_id, n: 1 });
    }

    const dailyRows = [...counts.values()].map((c) => {
      const hours = (c.n * sampleMin) / 60;
      return {
        user_id: c.user_id,
        afroloc_record_id: c.afroloc_record_id,
        day: dayStr,
        valid_samples: c.n,
        hours_present: Math.round(hours * 100) / 100,
        day_is_valid: hours >= minHours,
      };
    });

    if (dailyRows.length > 0) {
      const { error: upErr } = await admin
        .from('podp_daily_rollup')
        .upsert(dailyRows, { onConflict: 'afroloc_record_id,day' });
      if (upErr) throw upErr;
    }

    // Close cycles that end on yesterday
    // For each record that has a rollup row, look back cycleDays
    const recordIds = [...new Set(dailyRows.map((r) => r.afroloc_record_id))];
    const closedCycles: any[] = [];

    for (const recordId of recordIds) {
      const cycleStart = new Date(yest.getTime() - (cycleDays - 1) * 24 * 3600 * 1000)
        .toISOString().slice(0, 10);

      // Skip if cycle already closed
      const { data: existing } = await admin
        .from('podp_cycles')
        .select('id')
        .eq('afroloc_record_id', recordId)
        .eq('cycle_start', cycleStart)
        .eq('cycle_end', dayStr)
        .maybeSingle();
      if (existing) continue;

      const { data: rollups } = await admin
        .from('podp_daily_rollup')
        .select('user_id, day, day_is_valid, hours_present, valid_samples')
        .eq('afroloc_record_id', recordId)
        .gte('day', cycleStart)
        .lte('day', dayStr)
        .order('day', { ascending: true });

      const rows = rollups ?? [];
      const userId = rows[0]?.user_id;
      if (!userId) continue;

      // Build a per-day map covering the whole cycle window (missing days = invalid)
      const dayMap = new Map<string, { valid: boolean; hours: number; samples: number }>();
      for (const r of rows) {
        dayMap.set(r.day as string, {
          valid: !!r.day_is_valid,
          hours: Number(r.hours_present ?? 0),
          samples: Number(r.valid_samples ?? 0),
        });
      }
      const series: { day: string; valid: boolean; hours: number; samples: number }[] = [];
      for (let i = 0; i < cycleDays; i++) {
        const d = new Date(new Date(`${cycleStart}T00:00:00Z`).getTime() + i * 86400000)
          .toISOString().slice(0, 10);
        series.push(dayMap.get(d) ?? { day: d, valid: false, hours: 0, samples: 0 } as any);
        series[series.length - 1].day = d;
      }

      const validDays = series.filter((s) => s.valid).length;
      const verifiedPct = Math.round((validDays / cycleDays) * 1000) / 10; // 1 dec
      const totalHours = series.reduce((a, s) => a + s.hours, 0);
      const avgHoursPerDay = Math.round((totalHours / cycleDays) * 100) / 100;
      const avgHoursValidDay = validDays > 0
        ? Math.round((series.filter((s) => s.valid).reduce((a, s) => a + s.hours, 0) / validDays) * 100) / 100
        : 0;
      const totalSamples = series.reduce((a, s) => a + s.samples, 0);

      // Streaks
      let longestStreak = 0, cur = 0, currentStreak = 0;
      for (const s of series) {
        if (s.valid) { cur++; if (cur > longestStreak) longestStreak = cur; }
        else cur = 0;
      }
      for (let i = series.length - 1; i >= 0; i--) {
        if (series[i].valid) currentStreak++; else break;
      }

      // Consistency: 1 - stddev(hours)/minHours, clamped [0,1]
      const mean = totalHours / cycleDays;
      const variance = series.reduce((a, s) => a + (s.hours - mean) ** 2, 0) / cycleDays;
      const stddev = Math.sqrt(variance);
      const consistency = Math.max(0, Math.min(1, 1 - stddev / Math.max(minHours, 1)));

      const baseScore = validDays / cycleDays;                      // 0..1
      const streakBonus = Math.min(1, longestStreak / cycleDays);   // 0..1
      const finalScore = Math.round(
        (baseScore * 0.7 + streakBonus * 0.2 + consistency * 0.1) * 100,
      );
      const podpScore = Math.round(baseScore * 100); // backwards-compatible

      const kpi = {
        verified_pct: verifiedPct,
        valid_days: validDays,
        total_days: cycleDays,
        longest_streak: longestStreak,
        current_streak: currentStreak,
        avg_hours_per_day: avgHoursPerDay,
        avg_hours_valid_day: avgHoursValidDay,
        total_hours: Math.round(totalHours * 100) / 100,
        total_samples: totalSamples,
        consistency: Math.round(consistency * 100) / 100,
        base_score: podpScore,
        streak_bonus_pct: Math.round(streakBonus * 100),
        final_score: finalScore,
        min_hours_per_day: minHours,
        sample_interval_minutes: sampleMin,
        computed_at: new Date().toISOString(),
      };

      const { data: cyc, error: cycErr } = await admin
        .from('podp_cycles')
        .insert({
          user_id: userId,
          afroloc_record_id: recordId,
          cycle_start: cycleStart,
          cycle_end: dayStr,
          valid_days: validDays,
          total_days: cycleDays,
          podp_score: podpScore,
          applied_to_ats: true,
          kpi,
        })
        .select()
        .single();
      if (cycErr) { console.error('cycle insert', cycErr); continue; }
      closedCycles.push(cyc);

      // Propagate to afroloc_records.metadata.podp (non-breaking)
      const { data: rec } = await admin
        .from('afroloc_records')
        .select('metadata')
        .eq('id', recordId)
        .maybeSingle();
      const newMeta = {
        ...(rec?.metadata ?? {}),
        podp: {
          score: podpScore,
          final_score: finalScore,
          verified_pct: verifiedPct,
          longest_streak: longestStreak,
          current_streak: currentStreak,
          cycle_end: dayStr,
          valid_days: validDays,
          total_days: cycleDays,
        },
      };
      await admin.from('afroloc_records').update({ metadata: newMeta }).eq('id', recordId);

      await admin.from('security_audit_log').insert({
        action: 'podp_cycle_closed',
        function_name: 'podp-rollup',
        user_id: userId,
        details: { recordId, podpScore, finalScore, validDays, totalDays: cycleDays, longestStreak, currentStreak, cycleStart, cycleEnd: dayStr },
      }).catch(() => {});
    }

    // 90-day retention for raw samples
    const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    await admin.from('podp_samples').delete().lt('received_at', cutoff);

    return new Response(JSON.stringify({
      day: dayStr,
      dailyRowsUpserted: dailyRows.length,
      cyclesClosed: closedCycles.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('podp-rollup error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
