import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";

interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties?: {
    name?: string;
    NAME?: string;
    admin_path?: string;
    ADM_PATH?: string;
    [key: string]: unknown;
  };
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'admin_national');
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { geojson, source = 'geojson' } = body;

    if (!geojson) {
      return new Response(
        JSON.stringify({ error: 'GeoJSON data required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[import-urban-zones] User ${user.id} importing urban zones from ${source}`);

    let results: { imported_id: number; feature_name: string }[] = [];

    // Handle FeatureCollection
    if (geojson.type === 'FeatureCollection') {
      const featureCollection = geojson as GeoJSONFeatureCollection;
      console.log(`[import-urban-zones] Processing FeatureCollection with ${featureCollection.features.length} features`);

      const { data, error } = await supabase.rpc('import_urban_zones_bulk', {
        p_features: featureCollection.features,
        p_source: source
      });

      if (error) {
        console.error('[import-urban-zones] Bulk import error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      results = data || [];
    }
    // Handle single Feature
    else if (geojson.type === 'Feature') {
      const feature = geojson as GeoJSONFeature;
      const name = feature.properties?.name || feature.properties?.NAME || 'Urban Zone';
      const adminPath = feature.properties?.admin_path || feature.properties?.ADM_PATH || '';

      console.log(`[import-urban-zones] Processing single Feature: ${name}`);

      const { data, error } = await supabase.rpc('import_urban_zone', {
        p_name: name,
        p_admin_path: adminPath,
        p_source: source,
        p_geojson: JSON.stringify(feature.geometry)
      });

      if (error) {
        console.error('[import-urban-zones] Single import error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      results = [{ imported_id: data, feature_name: name }];
    }
    // Handle raw Geometry (wrap in Feature)
    else if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
      console.log(`[import-urban-zones] Processing raw ${geojson.type} geometry`);

      const { data, error } = await supabase.rpc('import_urban_zone', {
        p_name: body.name || 'Urban Zone',
        p_admin_path: body.admin_path || '',
        p_source: source,
        p_geojson: JSON.stringify(geojson)
      });

      if (error) {
        console.error('[import-urban-zones] Geometry import error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      results = [{ imported_id: data, feature_name: body.name || 'Urban Zone' }];
    }
    else {
      return new Response(
        JSON.stringify({ error: 'Invalid GeoJSON type. Expected Feature, FeatureCollection, Polygon, or MultiPolygon' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[import-urban-zones] Successfully imported ${results.length} urban zones`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: results.length,
        zones: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[import-urban-zones] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
