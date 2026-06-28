import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/auth_rbac.ts";

/**
 * RESIDENT CHECK-IN — Proof of Presence
 * 
 * Registers periodic GPS check-ins for AFROLOC addresses.
 * Enforces cooldown periods and updates ATS-relevant metrics.
 * 
 * POST body:
 *   afrolocRecordId: string  — the address to check into
 *   latitude: number         — current GPS lat
 *   longitude: number        — current GPS lon
 *   accuracy?: number        — GPS accuracy in meters
 *   deviceFingerprint?: string
 *   deviceInfo?: object
 */

const COOLDOWN_HOURS = 72;
const MAX_DISTANCE_URBAN_M = 150;
const MAX_DISTANCE_RURAL_M = 500;
const MAX_ACCURACY_METERS = 100;          // Reject if GPS accuracy too low
const MAX_SPEED_KMH = 300;               // Flag impossible travel speed

interface CheckinRequest {
  afrolocRecordId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  deviceFingerprint?: string;
  deviceInfo?: Record<string, unknown>;
}

function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT to get user
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: CheckinRequest = await req.json();
    const { afrolocRecordId, latitude, longitude, accuracy, deviceFingerprint, deviceInfo } = body;

    if (!afrolocRecordId || latitude == null || longitude == null) {
      return new Response(JSON.stringify({ error: 'Missing required fields: afrolocRecordId, latitude, longitude' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Server-side GPS accuracy validation
    if (accuracy != null && accuracy > MAX_ACCURACY_METERS) {
      return new Response(JSON.stringify({ 
        error: `GPS accuracy too low: ${Math.round(accuracy)}m (max ${MAX_ACCURACY_METERS}m). Move to an open area and retry.`,
        code: 'GPS_ACCURACY_INSUFFICIENT',
      }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Coordinate precision check — suspiciously round = spoofed
    const latDecimals = (latitude.toString().split('.')[1] || '').length;
    const lonDecimals = (longitude.toString().split('.')[1] || '').length;
    if (latDecimals < 4 || lonDecimals < 4) {
      await supabase.from('security_audit_log').insert({
        action: 'gps_spoofing_suspected',
        function_name: 'resident-checkin',
        user_id: user.id,
        details: { 
          reason: 'low_coordinate_precision', 
          latDecimals, lonDecimals,
          coordinates: { lat: latitude, lon: longitude },
        },
      }).catch(() => {});
      
      return new Response(JSON.stringify({
        error: 'GPS coordinates appear invalid. Please ensure location services are enabled.',
        code: 'GPS_PRECISION_INSUFFICIENT',
      }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch the address record
    const { data: record, error: recErr } = await supabase
      .from('afroloc_records')
      .select('id, user_id, geo_lat, geo_lon, metadata, next_checkin_due, checkin_streak, missed_checkins')
      .eq('id', afrolocRecordId)
      .single();

    if (recErr || !record) {
      return new Response(JSON.stringify({ error: 'Address not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify ownership
    if (record.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'You can only check in to your own addresses' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Cooldown check
    if (record.next_checkin_due) {
      const cooldownEnd = new Date(record.next_checkin_due);
      const now = new Date();
      if (now < cooldownEnd) {
        const remainingMs = cooldownEnd.getTime() - now.getTime();
        const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
        return new Response(JSON.stringify({
          error: 'Cooldown active',
          cooldownExpiresAt: record.next_checkin_due,
          remainingHours,
        }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 3. Distance validation
    const distance = haversineDistance(
      record.geo_lat, record.geo_lon,
      latitude, longitude
    );

    const isUrban = (record.metadata as any)?.cellType === 'urban' ||
                     (record.metadata as any)?.subdivisionType === 'urban';
    const maxDistance = isUrban ? MAX_DISTANCE_URBAN_M : MAX_DISTANCE_RURAL_M;
    const isValid = distance <= maxDistance;

    // 4. Calculate next cooldown
    const nextDue = new Date(Date.now() + COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();

    // 5. Insert checkin record
    const { data: checkin, error: insertErr } = await supabase
      .from('afroloc_checkins')
      .insert({
        user_id: user.id,
        afroloc_record_id: afrolocRecordId,
        geo_lat: latitude,
        geo_lon: longitude,
        accuracy_meters: accuracy,
        device_fingerprint: deviceFingerprint,
        device_info: deviceInfo,
        distance_from_address_meters: Math.round(distance),
        is_valid: isValid,
        rejection_reason: isValid ? null : `Distance ${Math.round(distance)}m exceeds ${maxDistance}m threshold`,
        cooldown_expires_at: nextDue,
      })
      .select()
      .single();

    if (insertErr) {
      throw new Error(`Failed to insert checkin: ${insertErr.message}`);
    }

    // 6. Update address record with checkin stats
    const newStreak = isValid ? (record.checkin_streak || 0) + 1 : 0;
    const newMissed = isValid ? (record.missed_checkins || 0) : (record.missed_checkins || 0) + 1;

    await supabase
      .from('afroloc_records')
      .update({
        last_checkin_at: new Date().toISOString(),
        next_checkin_due: nextDue,
        checkin_streak: newStreak,
        missed_checkins: newMissed,
      })
      .eq('id', afrolocRecordId);

    // 7. Log audit
    await supabase.from('security_audit_log').insert({
      action: 'resident_checkin',
      function_name: 'resident-checkin',
      user_id: user.id,
      details: {
        afrolocRecordId,
        distance: Math.round(distance),
        isValid,
        streak: newStreak,
      },
    }).catch(() => {});

    console.log(`Check-in ${checkin.id}: user=${user.id} dist=${Math.round(distance)}m valid=${isValid} streak=${newStreak}`);

    return new Response(JSON.stringify({
      success: true,
      checkin: {
        id: checkin.id,
        isValid,
        distanceMeters: Math.round(distance),
        maxDistanceMeters: maxDistance,
        streak: newStreak,
        cooldownExpiresAt: nextDue,
        nextCheckinDue: nextDue,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Check-in error:', error);
    return new Response(JSON.stringify({
      error: (error as Error).message,
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
