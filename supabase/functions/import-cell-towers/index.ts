import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";

interface CellTowerImport {
  cell_id: string;
  mcc: string;
  mnc: string;
  lac?: number;
  tac?: number;
  latitude: number;
  longitude: number;
  technology: string;
  coverage_radius_meters?: number;
  frequency_band?: string;
  level1_code?: string;
  level1_name?: string;
  level2_code?: string;
  level2_name?: string;
}

interface ImportRequest {
  operator_code: string;
  towers: CellTowerImport[];
}

// Angola operator configs
const ANGOLA_OPERATORS: Record<string, { name: string; mnc: string }> = {
  'UNITEL': { name: 'Unitel', mnc: '01' },
  'MOVICEL': { name: 'Movicel', mnc: '02' },
  'AFRICELL': { name: 'Africell', mnc: '04' },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin
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

    const { operator_code, towers }: ImportRequest = await req.json();

    // Validate operator
    const operator = ANGOLA_OPERATORS[operator_code?.toUpperCase()];
    if (!operator) {
      return new Response(JSON.stringify({ 
        error: 'Invalid operator', 
        valid_operators: Object.keys(ANGOLA_OPERATORS) 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    if (!towers?.length) {
      return new Response(JSON.stringify({ error: 'No towers provided' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get or create operator record
    let { data: telecomOp } = await supabase
      .from('telecom_operators')
      .select('id')
      .eq('operator_code', operator_code.toUpperCase())
      .eq('country_code', 'AO')
      .maybeSingle();

    if (!telecomOp) {
      const { data: newOp } = await supabase
        .from('telecom_operators')
        .insert({
          country_code: 'AO',
          operator_name: operator.name,
          operator_code: operator_code.toUpperCase(),
          phone_prefixes: [],
          otp_provider: 'twilio',
        })
        .select('id')
        .single();
      telecomOp = newOp;
    }

    // Prepare tower records
    const towerRecords = towers.map(t => ({
      telecom_operator_id: telecomOp?.id,
      cell_id: t.cell_id,
      mcc: '631', // Angola MCC
      mnc: operator.mnc,
      lac: t.lac,
      tac: t.tac,
      latitude: t.latitude,
      longitude: t.longitude,
      country_code: 'AO',
      technology: t.technology || '4G',
      coverage_radius_meters: t.coverage_radius_meters || 1000,
      frequency_band: t.frequency_band,
      level1_code: t.level1_code,
      level1_name: t.level1_name,
      level2_code: t.level2_code,
      level2_name: t.level2_name,
      is_active: true,
    }));

    // Upsert towers
    const { data: inserted, error } = await supabase
      .from('cell_towers')
      .upsert(towerRecords, { onConflict: 'cell_id,mcc,mnc', ignoreDuplicates: false })
      .select('id');

    if (error) throw error;

    console.log(`Imported ${inserted?.length || 0} towers for ${operator.name}`);

    return new Response(JSON.stringify({
      success: true,
      operator: operator.name,
      imported: inserted?.length || 0,
      total_submitted: towers.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Import error:', message);
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});