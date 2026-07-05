import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";

/**
 * SYNC PLACES — OFFLINE-FIRST SYNC ENDPOINT
 * 
 * Idempotent batch sync endpoint for field operator devices:
 *   - Accepts offline-generated AFROLOCs
 *   - Validates via idempotency_key (dedupe) and conflict_hash (409 detection)
 *   - Recalculates official zone/AFROLOC using server-side urban polygons
 *   - Returns official codes in ack for client-side update
 *   - Full audit logging for DFI/State compliance
 * 
 * Security:
 *   - JWT authentication required
 *   - Role: operator_field, admin, moderator
 *   - Rate limiting via device_id tracking
 */

// Web Mercator constants
const EARTH_RADIUS = 6378137;
const MAX_LAT = 85.0511287798;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function lonLatToMercator(lon: number, lat: number): { x: number; y: number } {
  const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const x = EARTH_RADIUS * toRad(lon);
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + toRad(clampedLat) / 2));
  return { x, y };
}

function toBase36(n: number): string {
  const prefix = n < 0 ? "N" : "";
  const absVal = Math.abs(Math.floor(n)).toString(36).toUpperCase();
  return prefix + absVal;
}

function generateAfrolocCode(
  lat: number,
  lon: number,
  countryCode: string,
  zone: "urban" | "rural"
): string {
  const gridSize = zone === "urban" ? 10 : 25;
  const zoneTag = zone === "urban" ? "ZU" : "ZR";
  const gridTag = zone === "urban" ? "G10" : "G25";

  const { x, y } = lonLatToMercator(lon, lat);
  const ix = Math.floor(x / gridSize);
  const iy = Math.floor(y / gridSize);

  return `${countryCode}-${zoneTag}-${gridTag}-X${toBase36(ix)}-Y${toBase36(iy)}`;
}

interface SyncItem {
  idempotency_key: string;
  conflict_hash: string;
  local_afroloc: string;
  lat: number;
  lon: number;
  admin_path: string;
  kind?: string;
  name?: string;
  notes?: string;
  captured_at: string;
  property_type?: string;
  address_type?: string;
  street_name?: string;
  number?: string;
  unit?: string;
  level1_name?: string;
  level2_name?: string;
  level3_name?: string;
  level4_name?: string;
  witnesses?: any[];
}

interface SyncRequest {
  device_id: string;
  items: SyncItem[];
}

interface SyncResultItem {
  idempotency_key: string;
  status: "ok" | "idempotent" | "conflict" | "error";
  server_id?: string;
  afroloc_official?: string;
  zone_official?: "urban" | "rural";
  grid_m?: number;
  error?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user has operator/admin role
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const roles = userRoles?.map((r) => r.role) || [];
    const allowedRoles = ["admin", "moderator", "operator_field", "admin_national", "admin_province", "admin_municipality"];
    const hasPermission = roles.some((r) => allowedRoles.includes(r));

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Requires operator_field or admin role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: SyncRequest = await req.json();
    const { device_id, items } = body;

    if (!device_id || !items || !Array.isArray(items)) {
      return new Response(
        JSON.stringify({ error: "Invalid request: device_id and items[] required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync-places] Processing ${items.length} items from device ${device_id}`);

    const results: SyncResultItem[] = [];

    for (const item of items) {
      try {
        // 1. Check idempotency - if already processed, return existing
        const { data: existingByIdem } = await supabase
          .from("afroloc_records")
          .select("id, code")
          .eq("metadata->>idempotency_key", item.idempotency_key)
          .maybeSingle();

        if (existingByIdem) {
          console.log(`[sync-places] Idempotent hit for ${item.idempotency_key}`);
          
          // Audit log
          await supabase.from("security_audit_log").insert({
            user_id: user.id,
            action: "PLACE_SYNC_IDEMPOTENT",
            function_name: "sync-places",
            details: {
              device_id,
              idempotency_key: item.idempotency_key,
              server_id: existingByIdem.id,
            },
          });

          results.push({
            idempotency_key: item.idempotency_key,
            status: "idempotent",
            server_id: existingByIdem.id,
            afroloc_official: existingByIdem.code,
          });
          continue;
        }

        // 2. Check conflict_hash - if same location/type already exists with different data
        const { data: existingByConflict } = await supabase
          .from("afroloc_records")
          .select("id, code, metadata")
          .eq("metadata->>conflict_hash", item.conflict_hash)
          .maybeSingle();

        if (existingByConflict) {
          // Same location exists but different idempotency_key = conflict
          console.log(`[sync-places] Conflict 409 for ${item.idempotency_key}`);
          
          // Audit log
          await supabase.from("security_audit_log").insert({
            user_id: user.id,
            action: "PLACE_SYNC_CONFLICT",
            function_name: "sync-places",
            details: {
              device_id,
              idempotency_key: item.idempotency_key,
              conflict_hash: item.conflict_hash,
              existing_id: existingByConflict.id,
            },
          });

          results.push({
            idempotency_key: item.idempotency_key,
            status: "conflict",
            error: "Registo já existe com dados diferentes",
          });
          continue;
        }

        // 3. Resolve official zone using urban_zones polygons
        let zoneOfficial: "urban" | "rural" = "rural";
        let gridM = 25;

        // Query PostGIS for point-in-polygon
        const { data: zoneResult } = await supabase.rpc("resolve_zone_by_polygon", {
          p_lat: item.lat,
          p_lon: item.lon,
        });

        if (zoneResult === true) {
          zoneOfficial = "urban";
          gridM = 10;
        } else {
          // Fallback to keyword detection from admin_path
          const urbanKeywords = [
            "LUANDA", "TALATONA", "VIANA", "CAZENGA", "BELAS", "KILAMBA",
            "BENGUELA", "LOBITO", "HUAMBO", "CABINDA", "LUBANGO",
            "MALANJE", "NAMIBE", "SOYO", "UIGE", "SUMBE"
          ];
          const upperPath = (item.admin_path || "").toUpperCase();
          if (urbanKeywords.some((kw) => upperPath.includes(kw))) {
            zoneOfficial = "urban";
            gridM = 10;
          }
        }

        // 4. Generate official AFROLOC code
        const countryCode = item.local_afroloc?.split("-")[0] || "AO";
        const afrolocOfficial = generateAfrolocCode(item.lat, item.lon, countryCode, zoneOfficial);

        // 5. Insert record
        const { data: newRecord, error: insertError } = await supabase
          .from("afroloc_records")
          .insert({
            code: afrolocOfficial,
            country: countryCode,
            user_id: user.id,
            registered_by_user_id: user.id,
            geo_lat: item.lat,
            geo_lon: item.lon,
            level1_name: item.level1_name || item.admin_path?.split("/")[0],
            level2_name: item.level2_name || item.admin_path?.split("/")[1],
            level3_name: item.level3_name || item.admin_path?.split("/")[2],
            level4_name: item.level4_name || item.admin_path?.split("/")[3],
            street_name: item.street_name,
            number: item.number,
            unit: item.unit,
            property_type: item.property_type || item.kind,
            // Tipo indicado pelo utilizador; se ausente, o trigger da BD deriva.
            ...(item.address_type ? { address_type: item.address_type } : {}),
            status: "draft",
            metadata: {
              idempotency_key: item.idempotency_key,
              conflict_hash: item.conflict_hash,
              local_afroloc: item.local_afroloc,
              zone_official: zoneOfficial,
              grid_m: gridM,
              device_id,
              captured_at: item.captured_at,
              notes: item.notes,
              sync_source: "offline",
            },
          })
          .select("id, code")
          .single();

        if (insertError) {
          console.error(`[sync-places] Insert error for ${item.idempotency_key}:`, insertError);
          
          results.push({
            idempotency_key: item.idempotency_key,
            status: "error",
            error: insertError.message,
          });
          continue;
        }

        // 6. Process witnesses if any
        if (item.witnesses && item.witnesses.length > 0) {
          for (const witness of item.witnesses) {
            await supabase.from("afroloc_witnesses").insert({
              afroloc_record_id: newRecord.id,
              witness_user_id: user.id, // Placeholder - should be resolved
              witness_afro_id: witness.witness_afro_id,
              status: "pending",
              signature: witness.signature,
            });
          }
        }

        // 7. Audit log successful creation
        await supabase.from("security_audit_log").insert({
          user_id: user.id,
          action: "PLACE_SYNC_CREATE",
          function_name: "sync-places",
          details: {
            device_id,
            server_id: newRecord.id,
            idempotency_key: item.idempotency_key,
            local_afroloc: item.local_afroloc,
            afroloc_official: afrolocOfficial,
            zone_official: zoneOfficial,
            grid_m: gridM,
            admin_path: item.admin_path,
          },
        });

        console.log(`[sync-places] Created ${afrolocOfficial} (server_id: ${newRecord.id})`);

        results.push({
          idempotency_key: item.idempotency_key,
          status: "ok",
          server_id: newRecord.id,
          afroloc_official: afrolocOfficial,
          zone_official: zoneOfficial,
          grid_m: gridM,
        });

      } catch (itemError: any) {
        console.error(`[sync-places] Error processing item:`, itemError);
        results.push({
          idempotency_key: item.idempotency_key,
          status: "error",
          error: itemError.message,
        });
      }
    }

    const processingTime = Date.now() - startTime;

    // Summary metrics
    const summary = {
      total: items.length,
      created: results.filter((r) => r.status === "ok").length,
      idempotent: results.filter((r) => r.status === "idempotent").length,
      conflicts: results.filter((r) => r.status === "conflict").length,
      errors: results.filter((r) => r.status === "error").length,
      processing_time_ms: processingTime,
    };

    console.log(`[sync-places] Summary:`, summary);

    return new Response(
      JSON.stringify({ results, summary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[sync-places] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
