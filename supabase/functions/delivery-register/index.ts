/**
 * AFROLOC Delivery Register Edge Function
 * Copyright © 2025 AFROFINTEK GmbH. All rights reserved.
 * 
 * Registers a new delivery point (PO Box, Locker, Pickup) for an AFROLOC address.
 * Sends OTP for confirmation.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";

interface DeliveryRegisterRequest {
  afroloc_record_id: string;
  operator_id: string;
  point_type: "po_box" | "locker" | "pickup";
  point_code: string;
  point_name?: string;
  point_address?: string;
  geo_lat?: number;
  geo_lon?: number;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

    const body: DeliveryRegisterRequest = await req.json();

    // Validate required fields
    if (!body.afroloc_record_id || !body.operator_id || !body.point_type || !body.point_code) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: afroloc_record_id, operator_id, point_type, point_code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify AFROLOC record belongs to user
    const { data: afrolocRecord, error: recordError } = await supabase
      .from("afroloc_records")
      .select("id, user_id, code")
      .eq("id", body.afroloc_record_id)
      .single();

    if (recordError || !afrolocRecord) {
      return new Response(
        JSON.stringify({ error: "AFROLOC record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (afrolocRecord.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "You can only add delivery points to your own AFROLOC records" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify operator exists and is active
    const { data: operator, error: operatorError } = await supabase
      .from("afroloc_operators")
      .select("id, code, name")
      .eq("id", body.operator_id)
      .eq("is_active", true)
      .single();

    if (operatorError || !operator) {
      return new Response(
        JSON.stringify({ error: "Operator not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from("afroloc_delivery_points")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("afroloc_record_id", body.afroloc_record_id)
      .eq("operator_id", body.operator_id)
      .eq("point_code", body.point_code)
      .neq("status", "revoked")
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "This delivery point is already registered", existing_id: existing.id }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Create delivery point
    const { data: deliveryPoint, error: insertError } = await supabase
      .from("afroloc_delivery_points")
      .insert({
        user_id: user.id,
        afroloc_record_id: body.afroloc_record_id,
        operator_id: body.operator_id,
        point_type: body.point_type,
        point_code: body.point_code,
        point_name: body.point_name || null,
        point_address: body.point_address || null,
        geo_lat: body.geo_lat || null,
        geo_lon: body.geo_lon || null,
        status: "pending_otp",
        otp_code: otp,
        otp_expires_at: otpExpiresAt,
        otp_attempts: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create delivery point", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log audit
    await supabase.from("afroloc_delivery_audit_log").insert({
      delivery_point_id: deliveryPoint.id,
      user_id: user.id,
      action: "register",
      new_values: {
        operator: operator.name,
        point_type: body.point_type,
        point_code: body.point_code,
      },
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
      user_agent: req.headers.get("user-agent"),
    });

    // TODO: Send OTP via SMS/Email based on user preferences
    // For now, return OTP in development mode
    const isDev = Deno.env.get("ENVIRONMENT") !== "production";

    return new Response(
      JSON.stringify({
        success: true,
        delivery_point_id: deliveryPoint.id,
        message: "Delivery point registered. Please confirm with OTP.",
        otp_expires_at: otpExpiresAt,
        ...(isDev && { otp_dev: otp }), // Only in development
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Delivery register error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
