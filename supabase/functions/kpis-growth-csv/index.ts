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

function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const months = parseInt(url.searchParams.get('months') || '12', 10);
    const country = url.searchParams.get('country');
    const zone = url.searchParams.get('zone');

    // Validate months
    if (isNaN(months) || months < 1 || months > 60) {
      return new Response(
        JSON.stringify({ error: 'months must be between 1 and 60' }),
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Fetching KPI growth - months: ${months}, country: ${country}, zone: ${zone}`);

    // Calculate start date
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    // Build query
    let query = supabase
      .from('afroloc_records')
      .select('created_at, code, status, address_type, country')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (country) {
      query = query.eq('country', country);
    }

    if (zone) {
      const addressType = zone === 'urban' ? 'formal' : 'digital';
      query = query.eq('address_type', addressType);
    }

    const { data: records, error: recordsError } = await query;
    if (recordsError) {
      console.error('Error fetching records:', recordsError);
      throw recordsError;
    }

    // Get total count before start date for cumulative calculation
    let baseQuery = supabase
      .from('afroloc_records')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', startDate.toISOString());

    if (country) {
      baseQuery = baseQuery.eq('country', country);
    }
    if (zone) {
      const addressType = zone === 'urban' ? 'formal' : 'digital';
      baseQuery = baseQuery.eq('address_type', addressType);
    }

    const { count: baseCount, error: baseError } = await baseQuery;
    if (baseError) {
      console.error('Error fetching base count:', baseError);
      throw baseError;
    }

    // Aggregate by month
    const monthlyStats = new Map<string, {
      new_places: number;
      unique_tiles: Set<string>;
      draft: number;
      verified: number;
      certified: number;
      formal: number;
      digital: number;
    }>();

    // Initialize all months in range
    const currentDate = new Date(startDate);
    const now = new Date();
    while (currentDate <= now) {
      const key = getMonthKey(currentDate);
      monthlyStats.set(key, {
        new_places: 0,
        unique_tiles: new Set(),
        draft: 0,
        verified: 0,
        certified: 0,
        formal: 0,
        digital: 0
      });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Process records
    for (const record of records || []) {
      const date = new Date(record.created_at);
      const key = getMonthKey(date);
      
      const stats = monthlyStats.get(key);
      if (!stats) continue;

      stats.new_places += 1;

      if (record.code) {
        const tileParts = record.code.split('-').slice(0, 4);
        stats.unique_tiles.add(tileParts.join('-'));
      }

      if (record.status === 'draft') stats.draft += 1;
      else if (record.status === 'verified') stats.verified += 1;
      else if (record.status === 'certified') stats.certified += 1;

      if (record.address_type === 'formal') stats.formal += 1;
      else stats.digital += 1;
    }

    // Convert to output rows with growth metrics
    const out: Record<string, unknown>[] = [];
    const sortedMonths = Array.from(monthlyStats.keys()).sort();
    
    let cumulativeTotal = baseCount || 0;
    let previousMonthPlaces = 0;

    for (let i = 0; i < sortedMonths.length; i++) {
      const month = sortedMonths[i];
      const stats = monthlyStats.get(month)!;
      
      cumulativeTotal += stats.new_places;
      
      // Calculate growth rate (month-over-month)
      const growthRate = previousMonthPlaces > 0 
        ? ((stats.new_places - previousMonthPlaces) / previousMonthPlaces * 100).toFixed(2)
        : '0.00';

      // Calculate 3-month moving average
      let movingAvg = stats.new_places;
      if (i >= 2) {
        const prev1 = monthlyStats.get(sortedMonths[i - 1])!.new_places;
        const prev2 = monthlyStats.get(sortedMonths[i - 2])!.new_places;
        movingAvg = (stats.new_places + prev1 + prev2) / 3;
      } else if (i === 1) {
        const prev1 = monthlyStats.get(sortedMonths[i - 1])!.new_places;
        movingAvg = (stats.new_places + prev1) / 2;
      }

      out.push({
        month: month,
        new_places: stats.new_places,
        cumulative_total: cumulativeTotal,
        unique_tiles: stats.unique_tiles.size,
        growth_rate_pct: growthRate,
        moving_avg_3m: movingAvg.toFixed(2),
        draft: stats.draft,
        verified: stats.verified,
        certified: stats.certified,
        formal: stats.formal,
        digital: stats.digital,
        country_filter: country || '',
        zone_filter: zone || ''
      });

      previousMonthPlaces = stats.new_places;
    }

    const headers = [
      'month', 'new_places', 'cumulative_total', 'unique_tiles',
      'growth_rate_pct', 'moving_avg_3m', 'draft', 'verified', 'certified',
      'formal', 'digital', 'country_filter', 'zone_filter'
    ];
    
    const bom = '\uFEFF';
    const csvContent = bom + objectsToCsv(headers, out);

    console.log(`KPI growth CSV generated: ${out.length} months`);

    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="afroloc_kpis_growth.csv"',
        'Cache-Control': 'public, max-age=600', // 10 minutes cache
      },
    });

  } catch (error) {
    console.error('Error in kpis-growth-csv function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
