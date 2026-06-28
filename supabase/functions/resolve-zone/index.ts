import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let lat: number;
    let lon: number;
    let adminPath: string | null = null;

    // Handle both GET and POST
    if (req.method === 'GET') {
      const url = new URL(req.url);
      lat = parseFloat(url.searchParams.get('lat') || '');
      lon = parseFloat(url.searchParams.get('lon') || '');
      adminPath = url.searchParams.get('admin_path');
    } else if (req.method === 'POST') {
      const body = await req.json();
      lat = body.lat;
      lon = body.lon;
      adminPath = body.admin_path || null;
    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate coordinates
    if (isNaN(lat) || isNaN(lon)) {
      return new Response(
        JSON.stringify({ error: 'Invalid coordinates. Required: lat, lon' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call resolve_zone function
    const { data, error } = await supabase.rpc('resolve_zone', {
      p_lon: lon,
      p_lat: lat,
      p_admin_path: adminPath,
      p_explicit_zone: null
    });

    if (error) {
      console.error('[resolve-zone] Error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const zone = data as string;
    const gridSize = zone === 'urban' ? 10 : 25;

    return new Response(
      JSON.stringify({
        lat,
        lon,
        zone,
        grid_size_meters: gridSize,
        zone_tag: zone === 'urban' ? 'ZU' : 'ZR',
        grid_tag: zone === 'urban' ? 'G10' : 'G25'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[resolve-zone] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
