import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

/**
 * BATCH RESOLVE — Resolve multiple coordinates to AFROLOC codes
 * 
 * POST body:
 *   points: Array<{ latitude: number; longitude: number; countryCode?: string; id?: string }>
 *   countryCode?: string  — default country code for all points
 * 
 * Response:
 *   results: Array<{ id?, latitude, longitude, afrolocCode, qgCode, sqCode, zone, gridSize, error? }>
 * 
 * Max 100 points per request.
 */

interface ResolvePoint {
  id?: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
}

interface ResolveResult {
  id?: string;
  latitude: number;
  longitude: number;
  afrolocCode?: string;
  qgCode?: string;
  sqCode?: string;
  zone?: string;
  gridSize?: number;
  bounds?: unknown;
  centroid?: unknown;
  error?: string;
}

const MAX_POINTS = 100;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { points, countryCode: defaultCountry } = body;

    if (!Array.isArray(points) || points.length === 0) {
      return new Response(JSON.stringify({ error: 'points array is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (points.length > MAX_POINTS) {
      return new Response(JSON.stringify({ error: `Maximum ${MAX_POINTS} points per request` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    console.log(`[BatchResolve] Processing ${points.length} points`);

    // Resolve all points in parallel via qg-engine
    const results: ResolveResult[] = await Promise.all(
      points.map(async (point: ResolvePoint): Promise<ResolveResult> => {
        const cc = point.countryCode || defaultCountry || 'AO';
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/qg-engine`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              latitude: point.latitude,
              longitude: point.longitude,
              countryCode: cc,
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            return {
              id: point.id,
              latitude: point.latitude,
              longitude: point.longitude,
              error: `QG Engine error: ${errText}`,
            };
          }

          const qgResult = await response.json();

          return {
            id: point.id,
            latitude: point.latitude,
            longitude: point.longitude,
            afrolocCode: qgResult.afroloc || qgResult.qgCode,
            qgCode: qgResult.qgCode,
            zone: qgResult.zone,
            gridSize: qgResult.grid_m,
            bounds: qgResult.bbox,
            centroid: qgResult.centroid,
          };
        } catch (err: unknown) {
          return {
            id: point.id,
            latitude: point.latitude,
            longitude: point.longitude,
            error: (err as Error).message,
          };
        }
      })
    );

    const resolved = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;

    console.log(`[BatchResolve] Done: ${resolved} resolved, ${failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      total: results.length,
      resolved,
      failed,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[BatchResolve] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
