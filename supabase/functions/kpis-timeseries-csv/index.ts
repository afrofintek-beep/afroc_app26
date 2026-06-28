import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function objectsToCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.map(escapeCSVField).join(',');
  const dataLines = rows.map(row => 
    headers.map(h => escapeCSVField(String(row[h] ?? ''))).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

function getDateKey(date: Date, period: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  switch (period) {
    case 'month':
      return `${year}-${month}`;
    case 'week':
      // ISO week calculation
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    default: // day
      return `${year}-${month}-${day}`;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const period = url.searchParams.get('period') || 'day';
    const daysParam = url.searchParams.get('days') || '365';
    const zone = url.searchParams.get('zone');
    const gridM = url.searchParams.get('grid_m');

    // Validate period
    if (!['day', 'week', 'month'].includes(period)) {
      return new Response(
        JSON.stringify({ error: 'period must be "day", "week", or "month"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate days
    const days = parseInt(daysParam, 10);
    if (isNaN(days) || days < 7 || days > 3650) {
      return new Response(
        JSON.stringify({ error: 'days must be between 7 and 3650' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate zone
    if (zone && !['urban', 'rural'].includes(zone)) {
      return new Response(
        JSON.stringify({ error: 'zone must be "urban" or "rural"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate grid_m
    const gridMNum = gridM ? parseInt(gridM, 10) : null;
    if (gridMNum !== null && (isNaN(gridMNum) || gridMNum < 1 || gridMNum > 200)) {
      return new Response(
        JSON.stringify({ error: 'grid_m must be between 1 and 200' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Fetching KPI timeseries - period: ${period}, days: ${days}, zone: ${zone}, grid_m: ${gridMNum}`);

    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build query
    let query = supabase
      .from('afroloc_records')
      .select('created_at, code')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (zone) {
      const addressType = zone === 'urban' ? 'formal' : 'digital';
      query = query.eq('address_type', addressType);
    }

    const { data: records, error: recordsError } = await query;
    if (recordsError) {
      console.error('Error fetching records:', recordsError);
      throw recordsError;
    }

    // Aggregate by period
    const aggregated = new Map<string, { places: number; tiles: Set<string> }>();

    for (const record of records || []) {
      const date = new Date(record.created_at);
      const key = getDateKey(date, period);
      
      if (!aggregated.has(key)) {
        aggregated.set(key, { places: 0, tiles: new Set() });
      }
      
      const bucket = aggregated.get(key)!;
      bucket.places += 1;
      
      // Extract QG tile (first 4 segments)
      if (record.code) {
        const tileParts = record.code.split('-').slice(0, 4);
        bucket.tiles.add(tileParts.join('-'));
      }
    }

    // Convert to output rows
    const out: Record<string, unknown>[] = [];
    const sortedKeys = Array.from(aggregated.keys()).sort();
    
    for (const key of sortedKeys) {
      const bucket = aggregated.get(key)!;
      out.push({
        date: key,
        places: bucket.places,
        tiles: bucket.tiles.size,
        period: period,
        days_window: days,
        zone_filter: zone || '',
        grid_m_filter: gridMNum || ''
      });
    }

    const headers = ['date', 'places', 'tiles', 'period', 'days_window', 'zone_filter', 'grid_m_filter'];
    const bom = '\uFEFF';
    const csvContent = bom + objectsToCsv(headers, out);

    console.log(`KPI timeseries CSV generated: ${out.length} rows`);

    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="afroloc_kpis_timeseries.csv"',
        'Cache-Control': 'public, max-age=600', // 10 minutes cache
      },
    });

  } catch (error) {
    console.error('Error in kpis-timeseries-csv function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
