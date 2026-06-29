import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";
import { sendSms } from "../_shared/sms.ts";

const sendOTPSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(10, "Número de telefone deve ter pelo menos 10 dígitos")
    .max(20, "Número de telefone deve ter menos de 20 caracteres")
    .regex(/^\+?[1-9]\d{9,14}$/, "Formato inválido. Use o formato internacional: +244912345678")
    .refine(
      (phone) => {
        // Ensure phone starts with + and country code
        return phone.startsWith("+");
      },
      { message: "Número deve começar com + e código do país (exemplo: +244912345678)" },
    ),
});

const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sha256Hex = async (input: string): Promise<string> => {
  const data = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const isDevelopmentEnv = Deno.env.get("ENVIRONMENT") === "development";

    const body = await req.json();

    // Sanitize phone number before validation
    if (body.phone && typeof body.phone === "string") {
      let cleanedPhone = body.phone.replace(/\+/g, "");
      cleanedPhone = cleanedPhone.replace(/\D/g, "");
      if (cleanedPhone.length > 0) {
        body.phone = "+" + cleanedPhone;
      }
    }

    const validationResult = sendOTPSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid input",
          details: validationResult.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const { phone } = validationResult.data;

    // Allow "test" numbers without strict production throttles and without SMS sending.
    // NOTE: keep this narrow to avoid exposing OTPs for real users.
    const isTestPhone = phone.startsWith("+244900") || phone.startsWith("+000");
    const isDevelopment = isDevelopmentEnv || isTestPhone;

    // IP rate limiting (skip in development or test phone)
    if (!isDevelopment) {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const { data: recentAttempts, error: rateLimitError } = await supabaseClient
        .from("security_events")
        .select("id")
        .eq("event_type", "otp_request")
        .eq("ip_address", ip)
        .eq("endpoint", "/functions/v1/send-signup-otp")
        .gte("created_at", oneHourAgo);

      if (rateLimitError) {
        console.error("Rate limit check failed:", rateLimitError);
      }

      if (recentAttempts && recentAttempts.length >= 10) {
        await supabaseClient.rpc("log_security_event", {
          p_event_type: "rate_limit",
          p_severity: "medium",
          p_ip_address: ip,
          p_user_agent: req.headers.get("user-agent"),
          p_endpoint: "/functions/v1/send-signup-otp",
          p_details: { limit: 10, period: "1 hour", count: recentAttempts.length },
        });

        return new Response(
          JSON.stringify({ error: "Too many requests. Please try again later." }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
    }

    // Phone-based rate limiting
    const phoneHash = await sha256Hex(phone);

    const phoneRateLimit = isDevelopment ? 50 : 3;
    const rateLimitPeriod = isDevelopment ? "5 minutos" : "1 hora";
    const rateLimitTime = isDevelopment ? 300000 : 3600000;

    const rateLimitStart = new Date(Date.now() - rateLimitTime).toISOString();
    const { data: phoneAttempts, error: phoneRateErr } = await supabaseClient
      .from("security_events")
      .select("id")
      .eq("event_type", "otp_request")
      .eq("endpoint", "/functions/v1/send-signup-otp")
      .gte("created_at", rateLimitStart)
      .eq("details->>phone_hash", phoneHash);

    if (phoneRateErr) {
      console.error("Phone rate limit check failed", { error: phoneRateErr?.message });
    }

    if (phoneAttempts && phoneAttempts.length >= phoneRateLimit) {
      await supabaseClient.rpc("log_security_event", {
        p_event_type: "rate_limit",
        p_severity: "high",
        p_ip_address: ip,
        p_user_agent: req.headers.get("user-agent"),
        p_endpoint: "/functions/v1/send-signup-otp",
        p_details: {
          phone_masked: phone.substring(0, 5) + "***",
          phone_hash: phoneHash,
          limit: phoneRateLimit,
          period: rateLimitPeriod,
          environment: isDevelopment ? "development" : "production",
        },
      });

      return new Response(
        JSON.stringify({
          error: `Muitas solicitações de OTP para este número. Tente novamente em ${rateLimitPeriod}.`,
          retry_after: isDevelopment ? "30 minutos" : "1 hora",
        }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Log this OTP request
    await supabaseClient.rpc("log_security_event", {
      p_event_type: "otp_request",
      p_severity: "low",
      p_ip_address: ip,
      p_user_agent: req.headers.get("user-agent"),
      p_endpoint: "/functions/v1/send-signup-otp",
      p_details: {
        phone_masked: phone.substring(0, 5) + "***",
        phone_hash: phoneHash,
        test_phone: isTestPhone,
      },
    });

    console.log("Signup OTP generation initiated", {
      event: "signup_otp_start",
      phone: phone.substring(0, 5) + "***",
      timestamp: new Date().toISOString(),
    });

    // Validate phone number with telecom operator detection
    const { data: operatorData, error: operatorError } = await supabaseClient
      .rpc("get_telecom_operator_by_phone", {
        phone_number: phone,
      });

    if (operatorError || !operatorData || operatorData.length === 0) {
      console.error("Phone operator validation failed", {
        event: "operator_validation_failed",
        phone: phone.substring(0, 5) + "***",
        error: operatorError?.message,
        timestamp: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ error: "Invalid phone number. Please verify and try again." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const operator = operatorData[0];
    const isDevProvider = operator.otp_provider === "development" || operator.operator_code === "TEST";

    console.log("Phone operator detected", {
      event: "operator_detected",
      operator: operator.operator_name,
      country: operator.country_code,
      provider: operator.otp_provider,
      timestamp: new Date().toISOString(),
    });

    // Generate OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Store OTP (single active per phone)
    const { error: upsertError } = await supabaseClient
      .from("phone_otp_verifications")
      .upsert({
        phone_number: phone,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        verified: false,
        attempts: 0,
        operator_name: operator.operator_name,
        operator_code: operator.operator_code,
        country_code: operator.country_code,
      }, { onConflict: "phone_number" });

    if (upsertError) {
      console.error("Database upsert failed", {
        event: "db_error",
        error: upsertError.message,
        timestamp: new Date().toISOString(),
      });
      throw upsertError;
    }

    // If this is a test phone / development provider, don't send SMS and return OTP for testing.
    if (isTestPhone || isDevProvider) {
      console.log("Skipping SMS send (test/dev)", {
        event: "otp_test_mode",
        phone: phone.substring(0, 5) + "***",
        operator: operator.operator_code,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "OTP gerado em modo de teste",
          expires_at: expiresAt.toISOString(),
          operator: {
            name: operator.operator_name,
            code: operator.operator_code,
            country: operator.country_code,
          },
          dev_mode: true,
          dev_otp_code: otpCode,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    console.log("OTP saved, sending SMS", {
      event: "otp_sms_start",
      timestamp: new Date().toISOString(),
    });

    // Send SMS via Twilio
    try {
      const smsMessage =
        `Seu código de verificação AFROLOC: ${otpCode}. Válido por 10 minutos. Não compartilhe este código.`;

      // Envio via Infobip (helper partilhado _shared/sms.ts).
      const smsResult = await sendSms(phone, smsMessage);

      if (!smsResult.ok) {
        console.error("SMS send failed (Infobip)", {
          event: "sms_send_error",
          error: smsResult.error,
          country: operator.country_code,
          timestamp: new Date().toISOString(),
        });
        throw new Error("Falha ao enviar SMS. " + (smsResult.error ?? "Tente novamente."));
      }

      console.log("SMS sent successfully", {
        event: "sms_sent",
        timestamp: new Date().toISOString(),
      });
    } catch (smsError) {
      const errorMessage = smsError instanceof Error ? smsError.message : String(smsError);
      console.error("SMS exception", {
        event: "sms_exception",
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw new Error(errorMessage);
    }

    console.log("Signup OTP process completed", {
      event: "signup_otp_complete",
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "OTP sent successfully",
        expires_at: expiresAt.toISOString(),
        operator: {
          name: operator.operator_name,
          code: operator.operator_code,
          country: operator.country_code,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Signup OTP generation failed", {
      event: "signup_otp_error",
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
};

serve(handler);
