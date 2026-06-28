/**
 * AFROLOC Delivery Revoke Edge Function
 * Copyright © 2025 AFROFINTEK GmbH. All rights reserved.
 * 
 * Revokes a delivery point from an AFROLOC record.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";

interface RevokeRequest {
  delivery_point_id: string;
  reason?: string;
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

    const body: RevokeRequest = await req.json();

    if (!body.delivery_point_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: delivery_point_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get delivery point
    const { data: deliveryPoint, error: fetchError } = await supabase
      .from("afroloc_delivery_points")
      .select("id, user_id, status, is_primary, point_code")
      .eq("id", body.delivery_point_id)
      .single();

    if (fetchError || !deliveryPoint) {
      return new Response(
        JSON.stringify({ error: "Delivery point not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ownership
    if (deliveryPoint.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "You can only revoke your own delivery points" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Already revoked?
    if (deliveryPoint.status === "revoked") {
      return new Response(
        JSON.stringify({ success: true, message: "Delivery point is already revoked" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const oldStatus = deliveryPoint.status;

    // Revoke the delivery point
    const { error: updateError } = await supabase
      .from("afroloc_delivery_points")
      .update({
        status: "revoked",
        is_primary: false,
        revoked_at: new Date().toISOString(),
        revoked_reason: body.reason || "User requested revocation",
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.delivery_point_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to revoke delivery point", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log audit
    await supabase.from("afroloc_delivery_audit_log").insert({
      delivery_point_id: body.delivery_point_id,
      user_id: user.id,
      action: "revoke",
      old_values: { status: oldStatus, is_primary: deliveryPoint.is_primary },
      new_values: { status: "revoked", is_primary: false, reason: body.reason },
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
      user_agent: req.headers.get("user-agent"),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Delivery point has been revoked",
        delivery_point_id: body.delivery_point_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Delivery revoke error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
