/**
 * AFROLOC Delivery Confirm Edge Function
 * Copyright © 2025 AFROFINTEK GmbH. All rights reserved.
 * 
 * Confirms a delivery point registration via OTP.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const MAX_OTP_ATTEMPTS = 5;

interface DeliveryConfirmRequest {
  delivery_point_id: string;
  otp: string;
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

    const body: DeliveryConfirmRequest = await req.json();

    if (!body.delivery_point_id || !body.otp) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: delivery_point_id, otp" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get delivery point
    const { data: deliveryPoint, error: fetchError } = await supabase
      .from("afroloc_delivery_points")
      .select("*")
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
        JSON.stringify({ error: "You can only confirm your own delivery points" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check status
    if (deliveryPoint.status !== "pending_otp") {
      return new Response(
        JSON.stringify({ error: "Delivery point is not pending OTP confirmation", current_status: deliveryPoint.status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check OTP attempts
    if (deliveryPoint.otp_attempts >= MAX_OTP_ATTEMPTS) {
      // Revoke due to too many attempts
      await supabase
        .from("afroloc_delivery_points")
        .update({ 
          status: "revoked", 
          revoked_at: new Date().toISOString(),
          revoked_reason: "Too many OTP attempts" 
        })
        .eq("id", body.delivery_point_id);

      return new Response(
        JSON.stringify({ error: "Too many OTP attempts. Delivery point has been revoked." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check OTP expiry
    if (new Date(deliveryPoint.otp_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "OTP has expired. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify OTP
    if (deliveryPoint.otp_code !== body.otp) {
      // Increment attempts
      await supabase
        .from("afroloc_delivery_points")
        .update({ otp_attempts: deliveryPoint.otp_attempts + 1 })
        .eq("id", body.delivery_point_id);

      const attemptsLeft = MAX_OTP_ATTEMPTS - deliveryPoint.otp_attempts - 1;
      return new Response(
        JSON.stringify({ 
          error: "Invalid OTP", 
          attempts_left: attemptsLeft,
          message: `Incorrect OTP. ${attemptsLeft} attempts remaining.`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // OTP is correct - activate delivery point
    const { error: updateError } = await supabase
      .from("afroloc_delivery_points")
      .update({
        status: "active",
        otp_code: null, // Clear OTP
        otp_expires_at: null,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", body.delivery_point_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to confirm delivery point", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log audit
    await supabase.from("afroloc_delivery_audit_log").insert({
      delivery_point_id: body.delivery_point_id,
      user_id: user.id,
      action: "confirm",
      old_values: { status: "pending_otp" },
      new_values: { status: "active" },
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
      user_agent: req.headers.get("user-agent"),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Delivery point confirmed and activated",
        delivery_point_id: body.delivery_point_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Delivery confirm error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
