/**
 * AFROLOC Delivery Register Edge Function
 * Copyright © 2025 AFROFINTEK GmbH. All rights reserved.
 *
 * Registers a new delivery point (PO Box, Locker, Pickup) for an AFROLOC address
 * and sends a one-time confirmation code (OTP) to the delivery point owner's own
 * channel (e-mail / WhatsApp / SMS). The OTP is NEVER returned to the client and
 * is stored HASHED at rest (SHA-256 hex) in the existing `otp_code` column.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";
import { sha256String } from "../_shared/hash_utils.ts";
import { settings } from "../_shared/settings.ts";
import { sendSms } from "../_shared/sms.ts";
import { sendWhatsAppOtp } from "../_shared/whatsapp.ts";

type ChannelType = "email" | "whatsapp" | "sms";

interface DeliveryRegisterRequest {
  afroloc_record_id: string;
  operator_id: string;
  point_type: "po_box" | "locker" | "pickup";
  point_code: string;
  point_name?: string;
  point_address?: string;
  geo_lat?: number;
  geo_lon?: number;
  /** Optional: pin the channel used to deliver the OTP. */
  channel_type?: ChannelType;
  /** Optional: explicit destination (e-mail address or phone) for the OTP. */
  channel_value?: string;
}

/** Minimum seconds between two OTP sends for the same pending point. */
const RESEND_COOLDOWN_SECONDS = 60;
/** Maximum number of OTP sends allowed per delivery point record. */
const MAX_OTP_SENDS = 5;
/** OTP validity window (minutes). */
const OTP_EXPIRE_MINUTES = settings.OTP_EXPIRE_MINUTES; // 10

/**
 * Generate a cryptographically-secure 6-digit OTP.
 * Uses a CSPRNG (crypto.getRandomValues) — never Math.random().
 * Rejection sampling keeps the distribution uniform across 000000-999999.
 */
function generateOTP(): string {
  const buf = new Uint32Array(1);
  const LIMIT = 1_000_000;
  // 4294967295 is the largest Uint32; 4294000000 is the largest multiple of 1e6
  // below it, so values above that are rejected to avoid modulo bias.
  const MAX_UNBIASED = 4_294_000_000;
  let n: number;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= MAX_UNBIASED);
  return (n % LIMIT).toString().padStart(6, "0");
}

function isEmail(value: string | null | undefined): value is string {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Presence of the secrets each channel needs to operate. */
function resendConfigured(): boolean {
  return !!Deno.env.get("RESEND_API_KEY");
}
function whatsappConfigured(): boolean {
  return !!(
    Deno.env.get("WHATSAPP_TOKEN") &&
    Deno.env.get("WHATSAPP_PHONE_ID") &&
    Deno.env.get("WHATSAPP_TEMPLATE")
  );
}
function smsConfigured(): boolean {
  return !!(Deno.env.get("INFOBIP_BASE_URL") && Deno.env.get("INFOBIP_API_KEY"));
}

interface ResolvedChannel {
  type: ChannelType;
  destination: string;
}

/**
 * Decide which channel + destination to use for the OTP.
 * - If channel_type is pinned, honour it (using channel_value or a verified
 *   account fallback as the destination), provided that channel is operational.
 * - Otherwise apply priority: (1) e-mail via Resend, (2) WhatsApp, (3) SMS.
 * Returns null when no operational channel with a usable destination exists.
 */
function resolveChannel(
  body: DeliveryRegisterRequest,
  user: { email?: string | null; phone?: string | null; email_confirmed_at?: string | null; phone_confirmed_at?: string | null },
): ResolvedChannel | null {
  const pinnedValue = body.channel_value?.trim() || "";
  const verifiedEmail = user.email_confirmed_at ? user.email ?? "" : "";
  const verifiedPhone = user.phone_confirmed_at ? user.phone ?? "" : "";

  const emailDest = () => (isEmail(pinnedValue) ? pinnedValue : verifiedEmail);
  const phoneDest = () => (pinnedValue && !isEmail(pinnedValue) ? pinnedValue : verifiedPhone);

  if (body.channel_type) {
    switch (body.channel_type) {
      case "email": {
        const dest = emailDest();
        if (resendConfigured() && isEmail(dest)) return { type: "email", destination: dest };
        return null;
      }
      case "whatsapp": {
        const dest = phoneDest();
        if (whatsappConfigured() && dest) return { type: "whatsapp", destination: dest };
        return null;
      }
      case "sms": {
        const dest = phoneDest();
        if (smsConfigured() && dest) return { type: "sms", destination: dest };
        return null;
      }
    }
  }

  // No pinned channel: apply priority.
  const email = emailDest();
  if (resendConfigured() && isEmail(email)) return { type: "email", destination: email };

  const phone = phoneDest();
  if (whatsappConfigured() && phone) return { type: "whatsapp", destination: phone };
  if (smsConfigured() && phone) return { type: "sms", destination: phone };

  return null;
}

/** Send the plaintext OTP over the resolved channel. Never logs the code. */
async function sendOtp(channel: ResolvedChannel, otp: string): Promise<{ ok: boolean; error?: string }> {
  switch (channel.type) {
    case "email": {
      const apiKey = Deno.env.get("RESEND_API_KEY");
      if (!apiKey) return { ok: false, error: "RESEND_API_KEY não configurado" };
      const from = Deno.env.get("OTP_EMAIL_FROM") || "AFROLOC <onboarding@resend.dev>";
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [channel.destination],
            subject: "AFROLOC — código de confirmação do ponto de entrega",
            html:
              `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#333">` +
              `<h2>AFROLOC</h2>` +
              `<p>O seu código de confirmação do ponto de entrega é:</p>` +
              `<p style="font-size:28px;font-weight:bold;letter-spacing:4px">${otp}</p>` +
              `<p>Este código expira em ${OTP_EXPIRE_MINUTES} minutos. Se não solicitou este código, ignore esta mensagem.</p>` +
              `</div>`,
          }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return { ok: false, error: `Resend ${res.status}: ${text}` };
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
    case "whatsapp": {
      const r = await sendWhatsAppOtp(channel.destination, otp);
      return { ok: r.ok, error: r.error };
    }
    case "sms": {
      const text = `AFROLOC: o seu código de confirmação é ${otp}. Expira em ${OTP_EXPIRE_MINUTES} min.`;
      const r = await sendSms(channel.destination, text);
      return { ok: r.ok, error: r.error };
    }
  }
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

    if (body.channel_type && !["email", "whatsapp", "sms"].includes(body.channel_type)) {
      return new Response(
        JSON.stringify({ error: "Invalid channel_type. Use email, whatsapp or sms." }),
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

    // Resolve the delivery channel BEFORE touching the database so we never
    // persist a usable pending_otp row when there is nowhere to send the code.
    const channel = resolveChannel(body, user as unknown as {
      email?: string | null; phone?: string | null;
      email_confirmed_at?: string | null; phone_confirmed_at?: string | null;
    });
    if (!channel) {
      return new Response(
        JSON.stringify({
          error: "No delivery channel available",
          message:
            "Não existe canal operacional para enviar o código (e-mail verificado, WhatsApp ou SMS). Verifique o seu contacto ou a configuração do serviço.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate the OTP (plaintext kept only in memory) and its stored hash.
    const otp = generateOTP();
    const otpHash = await sha256String(otp);
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000).toISOString();
    const nowMs = Date.now();

    // Check for an existing (non-revoked) point for this exact code.
    const { data: existing } = await supabase
      .from("afroloc_delivery_points")
      .select("id, status, metadata")
      .eq("user_id", user.id)
      .eq("afroloc_record_id", body.afroloc_record_id)
      .eq("operator_id", body.operator_id)
      .eq("point_code", body.point_code)
      .neq("status", "revoked")
      .single();

    if (existing) {
      // An already-active point cannot be re-registered.
      if (existing.status !== "pending_otp") {
        return new Response(
          JSON.stringify({ error: "This delivery point is already registered", existing_id: existing.id }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Pending point → treat this as a resend, with anti-abuse guards.
      const meta = (existing.metadata as Record<string, unknown>) || {};
      const sendCount = typeof meta.otp_send_count === "number" ? meta.otp_send_count : 0;
      const lastSentAt = typeof meta.otp_last_sent_at === "string" ? Date.parse(meta.otp_last_sent_at) : 0;

      if (lastSentAt && nowMs - lastSentAt < RESEND_COOLDOWN_SECONDS * 1000) {
        const retryIn = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - (nowMs - lastSentAt)) / 1000);
        return new Response(
          JSON.stringify({
            error: "Please wait before requesting a new code",
            retry_after_seconds: retryIn,
            message: `Aguarde ${retryIn}s antes de pedir um novo código.`,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (sendCount >= MAX_OTP_SENDS) {
        return new Response(
          JSON.stringify({
            error: "Too many code requests for this delivery point",
            message: "Limite de envios de código atingido para este ponto. Remova-o e registe novamente.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send first; only persist the new hash if delivery succeeded.
      const sent = await sendOtp(channel, otp);
      if (!sent.ok) {
        console.error("OTP resend failed:", sent.error);
        return new Response(
          JSON.stringify({
            error: "Failed to send confirmation code",
            message: "Não foi possível enviar o código pelo canal disponível. Tente novamente mais tarde.",
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: resendUpdateError } = await supabase
        .from("afroloc_delivery_points")
        .update({
          otp_code: otpHash,
          otp_expires_at: otpExpiresAt,
          otp_attempts: 0,
          metadata: {
            ...meta,
            otp_channel: channel.type,
            otp_send_count: sendCount + 1,
            otp_last_sent_at: new Date(nowMs).toISOString(),
          },
        })
        .eq("id", existing.id);

      if (resendUpdateError) {
        return new Response(
          JSON.stringify({ error: "Failed to update delivery point", details: resendUpdateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("afroloc_delivery_audit_log").insert({
        delivery_point_id: existing.id,
        user_id: user.id,
        action: "otp_resend",
        new_values: { channel: channel.type },
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
        user_agent: req.headers.get("user-agent"),
      });

      return new Response(
        JSON.stringify({
          success: true,
          delivery_point_id: existing.id,
          message: "Novo código enviado. Confirme para ativar o ponto de entrega.",
          channel: channel.type,
          otp_expires_at: otpExpiresAt,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No existing point → create a fresh pending point with the hashed OTP.
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
        otp_code: otpHash,
        otp_expires_at: otpExpiresAt,
        otp_attempts: 0,
        metadata: {
          otp_channel: channel.type,
          otp_send_count: 1,
          otp_last_sent_at: new Date(nowMs).toISOString(),
        },
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

    // Send the OTP. If delivery fails, roll back the row so no unusable
    // pending record is left behind.
    const sent = await sendOtp(channel, otp);
    if (!sent.ok) {
      console.error("OTP send failed:", sent.error);
      await supabase.from("afroloc_delivery_points").delete().eq("id", deliveryPoint.id);
      return new Response(
        JSON.stringify({
          error: "Failed to send confirmation code",
          message: "Não foi possível enviar o código pelo canal disponível. Tente novamente mais tarde.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log audit (never logs the OTP itself)
    await supabase.from("afroloc_delivery_audit_log").insert({
      delivery_point_id: deliveryPoint.id,
      user_id: user.id,
      action: "register",
      new_values: {
        operator: operator.name,
        point_type: body.point_type,
        point_code: body.point_code,
        channel: channel.type,
      },
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
      user_agent: req.headers.get("user-agent"),
    });

    return new Response(
      JSON.stringify({
        success: true,
        delivery_point_id: deliveryPoint.id,
        message: "Delivery point registered. Please confirm with the code sent to your channel.",
        channel: channel.type,
        otp_expires_at: otpExpiresAt,
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
