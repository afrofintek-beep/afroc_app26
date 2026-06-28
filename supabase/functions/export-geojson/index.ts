import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/auth_rbac.ts";

/**
 * EXPORT GEOJSON — Export AFROLOC addresses as GeoJSON FeatureCollection
 * 
 * GET params:
 *   countryCode? — filter by country (e.g. AO)
 *   status?      — filter by status (draft, verified, certified, etc.)
 *   level1Code?  — filter by province
 *   level2Code?  — filter by municipality
 *   limit?       — max records (default 500, max 5000)
 * 
 * Returns: GeoJSON FeatureCollection
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const countryCode = url.searchParams.get('countryCode');
    const status = url.searchParams.get('status');
    const level1Code = url.searchParams.get('level1Code');
    const level2Code = url.searchParams.get('level2Code');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '500'), 5000);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('afroloc_records')
      .select('id, code, country, level1_name, level2_name, level3_name, level4_name, street_name, number, property_type, geo_lat, geo_lon, status, address_type, created_at, last_verified_at, checkin_streak')
      .not('geo_lat', 'is', null)
      .not('geo_lon', 'is', null);

    if (countryCode) query = query.eq('country', countryCode);
    if (status) query = query.eq('status', status);
    if (level1Code) query = query.eq('level1_code', level1Code);
    if (level2Code) query = query.eq('level2_code', level2Code);

    const { data: records, error } = await query.limit(limit);

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    console.log(`[ExportGeoJSON] Exporting ${records?.length || 0} features`);

    // Build GeoJSON FeatureCollection
    const geojson = {
      type: 'FeatureCollection',
      metadata: {
        source: 'AFROLOC',
        exportedAt: new Date().toISOString(),
        filters: { countryCode, status, level1Code, level2Code, limit },
        totalFeatures: records?.length || 0,
      },
      features: (records || []).map((r: any) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [r.geo_lon, r.geo_lat], // GeoJSON is [lon, lat]
        },
        properties: {
          id: r.id,
          code: r.code,
          country: r.country,
          province: r.level1_name,
          municipality: r.level2_name,
          commune: r.level3_name,
          neighborhood: r.level4_name,
          street: r.street_name,
          number: r.number,
          propertyType: r.property_type,
          addressType: r.address_type,
          status: r.status,
          createdAt: r.created_at,
          lastVerifiedAt: r.last_verified_at,
          checkinStreak: r.checkin_streak,
        },
      })),
    };

    return new Response(JSON.stringify(geojson), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/geo+json',
        'Content-Disposition': `attachment; filename="afroloc-export-${new Date().toISOString().slice(0, 10)}.geojson"`,
      },
    });

  } catch (error: unknown) {
    console.error('[ExportGeoJSON] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
