/**
 * AFROLOC Mobility API — Third-party access for urban mobility projects
 * Copyright © 2025 AFROFINTEK GmbH. All rights reserved.
 *
 * Endpoints:
 *   POST /lookup    — Lookup address by AFROLOC code
 *   POST /search    — Search addresses by area (bounding box)
 *   POST /reverse   — Reverse geocode (GPS → nearest AFROLOC)
 *   POST /create    — Create a new address (requires 'write' permission)
 *
 * Authentication: X-Api-Key header with partner API key
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/auth_rbac.ts";

// --- CORS with wildcard for third-party access ---
function mobilityHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "x-api-key, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Type": "application/json",
  };
}

function json(data: unknown, status: number, req?: Request) {
  return new Response(JSON.stringify(data), { status, headers: mobilityHeaders(req) });
}

// --- API Key validation ---
async function validateApiKey(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  requiredPermission: string,
  req?: Request,
): Promise<{ valid: true; keyId: string; partnerName: string } | { valid: false; response: Response }> {
  if (!apiKey || apiKey.length < 20) {
    return { valid: false, response: json({ error: "Missing or invalid X-Api-Key header" }, 401, req) };
  }

  // Hash the key and look it up
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  const { data: keyRow, error } = await supabase
    .from("partner_api_keys")
    .select("id, partner_name, permissions, is_active")
    .eq("api_key_hash", hashHex)
    .eq("is_active", true)
    .single();

  if (error || !keyRow) {
    return { valid: false, response: json({ error: "Invalid API key" }, 403, req) };
  }

  if (!keyRow.permissions.includes(requiredPermission)) {
    return {
      valid: false,
      response: json({ error: `API key lacks '${requiredPermission}' permission` }, 403, req),
    };
  }

  // Update usage stats (fire-and-forget)
  supabase
    .from("partner_api_keys")
    .update({ last_used_at: new Date().toISOString(), request_count: keyRow.request_count ?? 0 + 1 })
    .eq("id", keyRow.id)
    .then(() => {});

  return { valid: true, keyId: keyRow.id, partnerName: keyRow.partner_name };
}

// --- Log request ---
async function logRequest(
  supabase: ReturnType<typeof createClient>,
  keyId: string,
  partnerName: string,
  endpoint: string,
  method: string,
  statusCode: number,
  body: unknown,
  summary: string,
  req?: Request,
) {
  const ip = req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await supabase.from("partner_api_log").insert({
    api_key_id: keyId,
    partner_name: partnerName,
    endpoint,
    method,
    status_code: statusCode,
    request_body: body as Record<string, unknown>,
    response_summary: summary,
    ip_address: ip,
  });
}

// ===== HANDLERS =====

async function handleLookup(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  req?: Request,
) {
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : null;
  if (!code) return json({ error: "Missing 'code' field" }, 400, req);

  const { data, error } = await supabase
    .from("afroloc_records")
    .select("code, geo_lat, geo_lon, country, level1_name, level2_name, level3_name, level4_name, street_name, number, status, address_type")
    .eq("code", code)
    .limit(1)
    .single();

  if (error || !data) return json({ error: "Address not found" }, 404, req);

  return json({
    code: data.code,
    lat: data.geo_lat,
    lon: data.geo_lon,
    zone: data.address_type || null,
    status: data.status,
    country: data.country,
  }, 200, req);
}

async function handleSearch(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  req?: Request,
) {
  const { min_lat, max_lat, min_lon, max_lon, limit: rawLimit } = body as {
    min_lat?: number; max_lat?: number; min_lon?: number; max_lon?: number; limit?: number;
  };

  if (min_lat == null || max_lat == null || min_lon == null || max_lon == null) {
    return json({ error: "Required: min_lat, max_lat, min_lon, max_lon" }, 400, req);
  }

  // Validate bounding box is reasonable (max ~50km span)
  if (Math.abs(max_lat - min_lat) > 0.5 || Math.abs(max_lon - min_lon) > 0.5) {
    return json({ error: "Bounding box too large. Max ~50km span." }, 400, req);
  }

  const limit = Math.min(Math.max(rawLimit || 100, 1), 500);

  const { data, error } = await supabase
    .from("afroloc_records")
    .select("code, geo_lat, geo_lon, country, status, address_type")
    .gte("geo_lat", min_lat)
    .lte("geo_lat", max_lat)
    .gte("geo_lon", min_lon)
    .lte("geo_lon", max_lon)
    .not("geo_lat", "is", null)
    .limit(limit);

  if (error) return json({ error: "Search failed" }, 500, req);

  return json({
    count: data?.length || 0,
    addresses: (data || []).map(r => ({
      code: r.code,
      lat: r.geo_lat,
      lon: r.geo_lon,
      zone: r.address_type || null,
      status: r.status,
      country: r.country,
    })),
  }, 200, req);
}

async function handleReverse(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  req?: Request,
) {
  const lat = typeof body.lat === "number" ? body.lat : null;
  const lon = typeof body.lon === "number" ? body.lon : null;
  const radiusM = typeof body.radius_m === "number" ? Math.min(body.radius_m, 5000) : 500;

  if (lat == null || lon == null) return json({ error: "Required: lat, lon" }, 400, req);

  // Approximate degree offset for the radius
  const latDelta = radiusM / 111320;
  const lonDelta = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));

  const { data, error } = await supabase
    .from("afroloc_records")
    .select("code, geo_lat, geo_lon, country, status, address_type")
    .gte("geo_lat", lat - latDelta)
    .lte("geo_lat", lat + latDelta)
    .gte("geo_lon", lon - lonDelta)
    .lte("geo_lon", lon + lonDelta)
    .not("geo_lat", "is", null)
    .limit(20);

  if (error) return json({ error: "Reverse geocode failed" }, 500, req);

  // Sort by distance and return closest
  const withDist = (data || []).map(r => {
    const dLat = (r.geo_lat! - lat) * 111320;
    const dLon = (r.geo_lon! - lon) * 111320 * Math.cos((lat * Math.PI) / 180);
    return { ...r, distance_m: Math.round(Math.sqrt(dLat * dLat + dLon * dLon)) };
  }).sort((a, b) => a.distance_m - b.distance_m);

  const results = withDist.slice(0, 5).map(r => ({
    code: r.code,
    lat: r.geo_lat,
    lon: r.geo_lon,
    distance_m: r.distance_m,
    zone: r.address_type || null,
    status: r.status,
    country: r.country,
  }));

  return json({ count: results.length, nearest: results }, 200, req);
}

async function handleCreate(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  partnerName: string,
  req?: Request,
) {
  const { lat, lon, country } = body as { lat?: number; lon?: number; country?: string };

  if (lat == null || lon == null || !country) {
    return json({ error: "Required: lat, lon, country" }, 400, req);
  }

  if (typeof country !== "string" || country.length !== 2) {
    return json({ error: "Country must be a 2-letter ISO code" }, 400, req);
  }

  // Resolve zone
  let zone = "rural";
  let gridSize = 25;
  try {
    const { data: zoneData } = await supabase.rpc("resolve_zone", {
      p_lon: lon,
      p_lat: lat,
      p_admin_path: null,
      p_explicit_zone: null,
    });
    if (zoneData === "urban") {
      zone = "urban";
      gridSize = 10;
    }
  } catch {
    // fallback to rural
  }

  // Generate AFROLOC code via qg-engine
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const qgRes = await fetch(`${supabaseUrl}/functions/v1/qg-engine`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ lat, lon, country_code: country.toUpperCase(), zone }),
  });

  if (!qgRes.ok) {
    const errText = await qgRes.text();
    console.error("[mobility-api] qg-engine error:", errText);
    return json({ error: "Failed to generate AFROLOC code" }, 500, req);
  }

  const qgData = await qgRes.json();
  const afrolocCode = qgData.afroloc || qgData.code;

  if (!afrolocCode) {
    return json({ error: "Code generation returned empty" }, 500, req);
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from("afroloc_records")
    .select("id, code")
    .eq("code", afrolocCode)
    .limit(1);

  if (existing && existing.length > 0) {
    return json({
      code: existing[0].code,
      lat,
      lon,
      zone,
      grid_size_m: gridSize,
      status: "existing",
      message: "Address already exists at this location",
    }, 200, req);
  }

  // Create the record
  const { data: newRecord, error: insertErr } = await supabase
    .from("afroloc_records")
    .insert({
      code: afrolocCode,
      country: country.toUpperCase(),
      geo_lat: lat,
      geo_lon: lon,
      address_type: zone,
      status: "draft",
      user_id: "00000000-0000-0000-0000-000000000000", // system/partner placeholder
      metadata: { created_by_partner: partnerName, source: "mobility-api" },
    })
    .select("id, code, status")
    .single();

  if (insertErr) {
    console.error("[mobility-api] Insert error:", insertErr);
    return json({ error: "Failed to create address" }, 500, req);
  }

  return json({
    code: newRecord.code,
    id: newRecord.id,
    lat,
    lon,
    zone,
    grid_size_m: gridSize,
    status: "draft",
    message: "Address created successfully",
  }, 201, req);
}

// ===== MAIN =====

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: mobilityHeaders(req) });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed. Use POST." }, 405, req);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Parse body
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action.toLowerCase() : null;

    if (!action || !["lookup", "search", "reverse", "create"].includes(action)) {
      return json({
        error: "Missing or invalid 'action'. Use: lookup, search, reverse, create",
        docs: {
          lookup: { action: "lookup", code: "AO-LUA-..." },
          search: { action: "search", min_lat: -8.8, max_lat: -8.7, min_lon: 13.2, max_lon: 13.3 },
          reverse: { action: "reverse", lat: -8.838, lon: 13.234, radius_m: 500 },
          create: { action: "create", lat: -8.838, lon: 13.234, country: "AO" },
        },
      }, 400, req);
    }

    // Validate API key
    const apiKey = req.headers.get("x-api-key") || "";
    const requiredPerm = action === "create" ? "write" : "read";
    const auth = await validateApiKey(supabase, apiKey, requiredPerm, req);

    if (!auth.valid) return auth.response;

    // Route
    let result: Response;
    switch (action) {
      case "lookup":
        result = await handleLookup(supabase, body, req);
        break;
      case "search":
        result = await handleSearch(supabase, body, req);
        break;
      case "reverse":
        result = await handleReverse(supabase, body, req);
        break;
      case "create":
        result = await handleCreate(supabase, body, auth.partnerName, req);
        break;
      default:
        result = json({ error: "Unknown action" }, 400, req);
    }

    // Log (fire-and-forget)
    logRequest(supabase, auth.keyId, auth.partnerName, action, "POST", result.status, body, action, req);

    return result;
  } catch (err) {
    console.error("[mobility-api] Unhandled error:", err);
    return json({ error: "Internal server error" }, 500, req);
  }
});
