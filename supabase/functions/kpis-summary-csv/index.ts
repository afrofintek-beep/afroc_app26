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
    const zone = url.searchParams.get('zone'); // urban or rural
    const gridM = url.searchParams.get('grid_m');

    // Validate zone parameter
    if (zone && !['urban', 'rural'].includes(zone)) {
      return new Response(
        JSON.stringify({ error: 'zone must be "urban" or "rural"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate grid_m parameter
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

    console.log(`Fetching KPI summary - zone: ${zone}, grid_m: ${gridMNum}`);

    // Build query with optional filters
    let query = supabase.from('afroloc_records').select('*', { count: 'exact' });
    
    if (zone) {
      // Filter by address type based on zone
      const addressType = zone === 'urban' ? 'formal' : 'digital';
      query = query.eq('address_type', addressType);
    }

    const { count: totalPlaces, error: countError } = await query;
    if (countError) {
      console.error('Error counting places:', countError);
      throw countError;
    }

    // Get unique tiles (unique QG codes)
    const { data: tilesData, error: tilesError } = await supabase
      .from('afroloc_records')
      .select('code')
      .not('code', 'is', null);
    
    if (tilesError) {
      console.error('Error fetching tiles:', tilesError);
      throw tilesError;
    }

    // Extract unique QG prefixes (first 4 segments of AFROLOC code)
    const uniqueTiles = new Set(
      tilesData?.map(r => {
        const parts = r.code?.split('-').slice(0, 4);
        return parts?.join('-');
      }).filter(Boolean) || []
    );

    // Get new registrations in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { count: new30d, error: new30dError } = await supabase
      .from('afroloc_records')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString());
    
    if (new30dError) {
      console.error('Error counting 30d records:', new30dError);
      throw new30dError;
    }

    // Get new registrations in last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const { count: new90d, error: new90dError } = await supabase
      .from('afroloc_records')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', ninetyDaysAgo.toISOString());
    
    if (new90dError) {
      console.error('Error counting 90d records:', new90dError);
      throw new90dError;
    }

    // Get active provinces (level1)
    const { data: provincesData, error: provincesError } = await supabase
      .from('afroloc_records')
      .select('level1_name')
      .not('level1_name', 'is', null);
    
    if (provincesError) {
      console.error('Error fetching provinces:', provincesError);
      throw provincesError;
    }
    const activeProvinces = new Set(provincesData?.map(r => r.level1_name).filter(Boolean) || []).size;

    // Get active municipalities (level2)
    const { data: municipalitiesData, error: municipalitiesError } = await supabase
      .from('afroloc_records')
      .select('level2_name')
      .not('level2_name', 'is', null);
    
    if (municipalitiesError) {
      console.error('Error fetching municipalities:', municipalitiesError);
      throw municipalitiesError;
    }
    const activeMunicipalities = new Set(municipalitiesData?.map(r => r.level2_name).filter(Boolean) || []).size;

    // Get last update timestamp
    const { data: lastUpdateData, error: lastUpdateError } = await supabase
      .from('afroloc_records')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    const lastUpdate = lastUpdateData?.updated_at || new Date().toISOString();

    const rows = [{
      total_places: totalPlaces || 0,
      unique_tiles: uniqueTiles.size,
      new_30d: new30d || 0,
      new_90d: new90d || 0,
      active_provinces: activeProvinces,
      active_municipalities: activeMunicipalities,
      last_update: lastUpdate,
      zone_filter: zone || '',
      grid_m_filter: gridMNum || ''
    }];

    const headers = Object.keys(rows[0]);
    const bom = '\uFEFF';
    const csvContent = bom + objectsToCsv(headers, rows);

    console.log('KPI summary CSV generated successfully');

    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="afroloc_kpis_summary.csv"',
        'Cache-Control': 'public, max-age=600', // 10 minutes cache
      },
    });

  } catch (error) {
    console.error('Error in kpis-summary-csv function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
