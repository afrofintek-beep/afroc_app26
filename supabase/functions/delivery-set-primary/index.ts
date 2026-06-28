/**
 * AFROLOC Delivery Set Primary Edge Function
 * Copyright © 2025 AFROFINTEK GmbH. All rights reserved.
 * 
 * Sets a delivery point as the primary delivery channel for an AFROLOC record.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";

interface SetPrimaryRequest {
  delivery_point_id: string;
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

    const body: SetPrimaryRequest = await req.json();

    if (!body.delivery_point_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: delivery_point_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get delivery point
    const { data: deliveryPoint, error: fetchError } = await supabase
      .from("afroloc_delivery_points")
      .select("id, user_id, afroloc_record_id, status, is_primary, point_code")
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
        JSON.stringify({ error: "You can only set primary on your own delivery points" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check status - must be active
    if (deliveryPoint.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Only active delivery points can be set as primary", current_status: deliveryPoint.status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Already primary?
    if (deliveryPoint.is_primary) {
      return new Response(
        JSON.stringify({ success: true, message: "Delivery point is already primary" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Remove primary from other delivery points for same AFROLOC record
    await supabase
      .from("afroloc_delivery_points")
      .update({ is_primary: false })
      .eq("afroloc_record_id", deliveryPoint.afroloc_record_id)
      .eq("user_id", user.id)
      .eq("is_primary", true);

    // Set this one as primary
    const { error: updateError } = await supabase
      .from("afroloc_delivery_points")
      .update({ is_primary: true, updated_at: new Date().toISOString() })
      .eq("id", body.delivery_point_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to set primary", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log audit
    await supabase.from("afroloc_delivery_audit_log").insert({
      delivery_point_id: body.delivery_point_id,
      user_id: user.id,
      action: "set_primary",
      old_values: { is_primary: false },
      new_values: { is_primary: true },
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
      user_agent: req.headers.get("user-agent"),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Delivery point set as primary",
        delivery_point_id: body.delivery_point_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Delivery set primary error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
