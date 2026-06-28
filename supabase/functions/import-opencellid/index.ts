import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";

// Angola MCC and operator MNCs
const ANGOLA_MCC = '631';
const ANGOLA_OPERATORS: Record<string, { name: string; code: string }> = {
  '01': { name: 'Unitel', code: 'UNITEL' },
  '02': { name: 'Movicel', code: 'MOVICEL' },
  '04': { name: 'Africell', code: 'AFRICELL' },
};

interface OpenCellIDTower {
  radio: string;       // GSM, UMTS, LTE, NR
  mcc: number;
  net: number;         // MNC
  area: number;        // LAC/TAC
  cell: number;        // Cell ID
  unit: number;        // Primary Scrambling Code
  lon: number;
  lat: number;
  range: number;       // Coverage radius in meters
  samples: number;
  changeable: number;
  created: number;
  updated: number;
  averageSignal: number;
}

interface ImportRequest {
  country_code?: string;  // Default: AO (Angola)
  bounding_box?: {
    min_lat: number;
    max_lat: number;
    min_lon: number;
    max_lon: number;
  };
  limit?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { 
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get OpenCelliD API token from secrets
    const openCellIdToken = Deno.env.get('OPENCELLID_API_TOKEN');
    if (!openCellIdToken) {
      return new Response(JSON.stringify({ 
        error: 'OpenCelliD API token not configured',
        help: 'Add OPENCELLID_API_TOKEN secret. Get free token at https://opencellid.org/register'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    const body: ImportRequest = await req.json().catch(() => ({}));
    const countryCode = body.country_code || 'AO';
    
    // Default bounding box for Angola
    const bbox = body.bounding_box || {
      min_lat: -18.0,  // Southern border
      max_lat: -4.4,   // Northern border
      min_lon: 11.7,   // Western border
      max_lon: 24.1    // Eastern border
    };

    console.log(`Fetching towers for ${countryCode} within bbox:`, bbox);

    // OpenCelliD API endpoint for cell data
    const apiUrl = new URL('https://opencellid.org/cell/getInArea');
    apiUrl.searchParams.set('key', openCellIdToken);
    apiUrl.searchParams.set('BBOX', `${bbox.min_lon},${bbox.min_lat},${bbox.max_lon},${bbox.max_lat}`);
    apiUrl.searchParams.set('mcc', ANGOLA_MCC);
    apiUrl.searchParams.set('format', 'json');
    if (body.limit) {
      apiUrl.searchParams.set('limit', body.limit.toString());
    }

    const response = await fetch(apiUrl.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenCelliD API error:', errorText);
      return new Response(JSON.stringify({ 
        error: 'OpenCelliD API request failed',
        details: errorText
      }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    const data = await response.json();
    const towers: OpenCellIDTower[] = data.cells || [];

    console.log(`Received ${towers.length} towers from OpenCelliD`);

    if (towers.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No towers found in the specified area',
        imported: 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    // Get or create operator records
    const operatorMap = new Map<string, string>();
    for (const [mnc, opInfo] of Object.entries(ANGOLA_OPERATORS)) {
      let { data: existingOp } = await supabase
        .from('telecom_operators')
        .select('id')
        .eq('operator_code', opInfo.code)
        .eq('country_code', 'AO')
        .maybeSingle();

      if (!existingOp) {
        const { data: newOp } = await supabase
          .from('telecom_operators')
          .insert({
            country_code: 'AO',
            operator_name: opInfo.name,
            operator_code: opInfo.code,
            phone_prefixes: [],
            otp_provider: 'twilio',
            is_active: true
          })
          .select('id')
          .single();
        existingOp = newOp;
      }

      if (existingOp) {
        operatorMap.set(mnc, existingOp.id);
      }
    }

    // Map radio types to our technology format
    const radioMap: Record<string, string> = {
      'GSM': '2G',
      'CDMA': '2G', 
      'UMTS': '3G',
      'LTE': '4G',
      'NR': '5G'
    };

    // Prepare tower records
    const towerRecords = towers.map(t => {
      const mnc = t.net.toString().padStart(2, '0');
      const operatorId = operatorMap.get(mnc);
      
      return {
        telecom_operator_id: operatorId,
        cell_id: t.cell.toString(),
        mcc: ANGOLA_MCC,
        mnc: mnc,
        lac: t.area,
        tac: t.area, // For LTE, area is TAC
        latitude: t.lat,
        longitude: t.lon,
        country_code: 'AO',
        technology: radioMap[t.radio] || t.radio,
        coverage_radius_meters: t.range || 1000,
        max_rsrp: t.averageSignal || null,
        is_active: true,
        metadata: {
          source: 'opencellid',
          samples: t.samples,
          last_updated: new Date(t.updated * 1000).toISOString(),
          radio_type: t.radio
        }
      };
    }).filter(t => t.telecom_operator_id); // Only include towers with known operators

    if (towerRecords.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No towers matched known Angolan operators',
        imported: 0,
        total_received: towers.length
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    // Upsert towers in batches
    const batchSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < towerRecords.length; i += batchSize) {
      const batch = towerRecords.slice(i, i + batchSize);
      const { data: inserted, error } = await supabase
        .from('cell_towers')
        .upsert(batch, { 
          onConflict: 'cell_id,mcc,mnc', 
          ignoreDuplicates: false 
        })
        .select('id');

      if (error) {
        console.error('Batch insert error:', error);
      } else {
        totalInserted += inserted?.length || 0;
      }
    }

    // Log the import action
    await supabase.from('fine_audit_log').insert({
      action: 'IMPORT_OPENCELLID_TOWERS',
      actor_user_id: user.id,
      object_type: 'cell_towers',
      object_id: 'batch_import',
      new_values: {
        country_code: countryCode,
        bbox,
        towers_received: towers.length,
        towers_imported: totalInserted
      },
      hash_chain_curr: crypto.randomUUID(),
      result: 'success'
    });

    console.log(`Successfully imported ${totalInserted} towers`);

    return new Response(JSON.stringify({
      success: true,
      country_code: countryCode,
      bounding_box: bbox,
      towers_received: towers.length,
      towers_imported: totalInserted,
      operators_found: Array.from(operatorMap.keys()).map(mnc => ANGOLA_OPERATORS[mnc]?.name).filter(Boolean)
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Import error:', message);
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
