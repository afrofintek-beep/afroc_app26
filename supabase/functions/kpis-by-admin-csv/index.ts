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
    const level = url.searchParams.get('level') || 'municipality';
    const limitParam = url.searchParams.get('limit') || '200';
    const zone = url.searchParams.get('zone');
    const gridM = url.searchParams.get('grid_m');

    // Validate level
    if (!['province', 'municipality', 'comuna', 'admin_path'].includes(level)) {
      return new Response(
        JSON.stringify({ error: 'level must be "province", "municipality", "comuna", or "admin_path"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate limit
    const limit = parseInt(limitParam, 10);
    if (isNaN(limit) || limit < 1 || limit > 2000) {
      return new Response(
        JSON.stringify({ error: 'limit must be between 1 and 2000' }),
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

    console.log(`Fetching KPI by-admin - level: ${level}, limit: ${limit}, zone: ${zone}, grid_m: ${gridMNum}`);

    // Determine which fields to select based on level
    const selectFields = 'level1_name, level2_name, level3_name, level4_name, code';
    
    // Build query
    let query = supabase
      .from('afroloc_records')
      .select(selectFields);

    if (zone) {
      const addressType = zone === 'urban' ? 'formal' : 'digital';
      query = query.eq('address_type', addressType);
    }

    const { data: records, error: recordsError } = await query;
    if (recordsError) {
      console.error('Error fetching records:', recordsError);
      throw recordsError;
    }

    // Aggregate by the specified level
    const areaStats = new Map<string, {
      area: string;
      places: number;
      tiles: Set<string>;
    }>();

    for (const record of records || []) {
      let areaKey: string;
      
      switch (level) {
        case 'province':
          areaKey = record.level1_name || 'Unknown';
          break;
        case 'municipality':
          areaKey = record.level2_name || 'Unknown';
          break;
        case 'comuna':
          areaKey = record.level3_name || 'Unknown';
          break;
        case 'admin_path':
          // Full administrative path: Province > Municipality > Comuna > Quartier
          const parts = [
            record.level1_name,
            record.level2_name,
            record.level3_name,
            record.level4_name
          ].filter(Boolean);
          areaKey = parts.length > 0 ? parts.join(' > ') : 'Unknown';
          break;
        default:
          areaKey = 'Unknown';
      }

      if (!areaStats.has(areaKey)) {
        areaStats.set(areaKey, {
          area: areaKey,
          places: 0,
          tiles: new Set()
        });
      }

      const stats = areaStats.get(areaKey)!;
      stats.places += 1;

      // Extract QG tile (first 4 segments)
      if (record.code) {
        const tileParts = record.code.split('-').slice(0, 4);
        stats.tiles.add(tileParts.join('-'));
      }
    }

    // Sort by places descending and apply limit
    const sortedAreas = Array.from(areaStats.values())
      .sort((a, b) => b.places - a.places)
      .slice(0, limit);

    // Convert to output rows
    const out: Record<string, unknown>[] = sortedAreas.map(stats => ({
      area_level: level,
      area: stats.area,
      places: stats.places,
      tiles: stats.tiles.size,
      zone_filter: zone || '',
      grid_m_filter: gridMNum || ''
    }));

    const headers = ['area_level', 'area', 'places', 'tiles', 'zone_filter', 'grid_m_filter'];
    const bom = '\uFEFF';
    const csvContent = bom + objectsToCsv(headers, out);

    console.log(`KPI by-admin CSV generated: ${out.length} areas`);

    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="afroloc_kpis_by_admin.csv"',
        'Cache-Control': 'public, max-age=600', // 10 minutes cache
      },
    });

  } catch (error) {
    console.error('Error in kpis-by-admin-csv function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
