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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const country = url.searchParams.get('country') || 'AO';
    const zone = url.searchParams.get('zone');
    const gridM = url.searchParams.get('grid_m');

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

    console.log(`Fetching KPI by-province - country: ${country}, zone: ${zone}, grid_m: ${gridMNum}`);

    // Build query
    let query = supabase
      .from('afroloc_records')
      .select('level1_code, level1_name, level2_name, code, created_at, status, address_type')
      .eq('country', country);

    if (zone) {
      const addressType = zone === 'urban' ? 'formal' : 'digital';
      query = query.eq('address_type', addressType);
    }

    const { data: records, error: recordsError } = await query;
    if (recordsError) {
      console.error('Error fetching records:', recordsError);
      throw recordsError;
    }

    // Calculate date thresholds
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Aggregate by province (level1)
    const provinceStats = new Map<string, {
      level1_code: string;
      level1_name: string;
      total_places: number;
      unique_tiles: Set<string>;
      unique_municipalities: Set<string>;
      new_30d: number;
      new_90d: number;
      draft_count: number;
      verified_count: number;
      certified_count: number;
      formal_count: number;
      digital_count: number;
    }>();

    for (const record of records || []) {
      const key = record.level1_code || 'unknown';
      
      if (!provinceStats.has(key)) {
        provinceStats.set(key, {
          level1_code: record.level1_code || '',
          level1_name: record.level1_name || 'Unknown',
          total_places: 0,
          unique_tiles: new Set(),
          unique_municipalities: new Set(),
          new_30d: 0,
          new_90d: 0,
          draft_count: 0,
          verified_count: 0,
          certified_count: 0,
          formal_count: 0,
          digital_count: 0
        });
      }

      const stats = provinceStats.get(key)!;
      stats.total_places += 1;

      // Extract QG tile (first 4 segments)
      if (record.code) {
        const tileParts = record.code.split('-').slice(0, 4);
        stats.unique_tiles.add(tileParts.join('-'));
      }

      // Track municipalities
      if (record.level2_name) {
        stats.unique_municipalities.add(record.level2_name);
      }

      // Check creation date
      const createdAt = new Date(record.created_at);
      if (createdAt >= thirtyDaysAgo) {
        stats.new_30d += 1;
      }
      if (createdAt >= ninetyDaysAgo) {
        stats.new_90d += 1;
      }

      // Count by status
      if (record.status === 'draft') stats.draft_count += 1;
      else if (record.status === 'verified') stats.verified_count += 1;
      else if (record.status === 'certified') stats.certified_count += 1;

      // Count by address type
      if (record.address_type === 'formal') stats.formal_count += 1;
      else stats.digital_count += 1;
    }

    // Convert to output rows
    const out: Record<string, unknown>[] = [];
    const sortedProvinces = Array.from(provinceStats.entries()).sort((a, b) => 
      b[1].total_places - a[1].total_places
    );

    for (const [, stats] of sortedProvinces) {
      out.push({
        country: country,
        level1_code: stats.level1_code,
        level1_name: stats.level1_name,
        total_places: stats.total_places,
        unique_tiles: stats.unique_tiles.size,
        municipalities: stats.unique_municipalities.size,
        new_30d: stats.new_30d,
        new_90d: stats.new_90d,
        draft: stats.draft_count,
        verified: stats.verified_count,
        certified: stats.certified_count,
        formal: stats.formal_count,
        digital: stats.digital_count,
        zone_filter: zone || '',
        grid_m_filter: gridMNum || ''
      });
    }

    const headers = [
      'country', 'level1_code', 'level1_name', 'total_places', 'unique_tiles',
      'municipalities', 'new_30d', 'new_90d', 'draft', 'verified', 'certified',
      'formal', 'digital', 'zone_filter', 'grid_m_filter'
    ];
    
    const bom = '\uFEFF';
    const csvContent = bom + objectsToCsv(headers, out);

    console.log(`KPI by-province CSV generated: ${out.length} provinces`);

    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="afroloc_kpis_by_province.csv"',
        'Cache-Control': 'public, max-age=600', // 10 minutes cache
      },
    });

  } catch (error) {
    console.error('Error in kpis-by-province-csv function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
