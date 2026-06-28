/**
 * AFROLOC Delivery List Edge Function
 * Copyright © 2025 AFROFINTEK GmbH. All rights reserved.
 * 
 * Lists delivery points for a user or specific AFROLOC record.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";

interface DeliveryListRequest {
  afroloc_record_id?: string;
  include_revoked?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: DeliveryListRequest = {};
    try {
      if (req.method === "POST") {
        body = await req.json();
      }
    } catch {
      // GET request or empty body
    }

    // Build query
    let query = supabase
      .from("afroloc_delivery_points")
      .select(`
        id,
        afroloc_record_id,
        point_type,
        point_code,
        point_name,
        point_address,
        geo_lat,
        geo_lon,
        is_primary,
        status,
        confirmed_at,
        created_at,
        updated_at,
        operator:afroloc_operators(id, code, name, logo_path)
      `)
      .eq("user_id", user.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });

    // Filter by AFROLOC record if specified
    if (body.afroloc_record_id) {
      query = query.eq("afroloc_record_id", body.afroloc_record_id);
    }

    // Exclude revoked unless requested
    if (!body.include_revoked) {
      query = query.neq("status", "revoked");
    }

    const { data: deliveryPoints, error: queryError } = await query;

    if (queryError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch delivery points", details: queryError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get operators list for adding new points
    const { data: operators } = await supabase
      .from("afroloc_operators")
      .select("id, code, name, operator_type, logo_path")
      .eq("is_active", true)
      .order("name");

    return new Response(
      JSON.stringify({
        success: true,
        delivery_points: deliveryPoints || [],
        count: deliveryPoints?.length || 0,
        available_operators: operators || [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Delivery list error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
