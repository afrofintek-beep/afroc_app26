import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const verifyOTPSchema = z.object({
  phone: z.string()
    .trim()
    .min(10, "Phone number must be at least 10 digits")
    .max(20, "Phone number must be less than 20 characters"),
  otp_code: z.string()
    .trim()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d{6}$/, "OTP must contain only digits"),
});

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
      }
    );

    const body = await req.json();
    
    // Validate input
    const validationResult = verifyOTPSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input", 
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { phone, otp_code } = validationResult.data;

    console.log("OTP verification initiated", { 
      event: "otp_verify_start",
      phone: phone.substring(0, 5) + "***", // Masked phone
      timestamp: new Date().toISOString()
    });

    // Get most recent OTP record
    const { data: otpRecords, error: fetchError } = await supabaseClient
      .from("phone_otp_verifications")
      .select("*")
      .eq("phone_number", phone)
      .order("created_at", { ascending: false })
      .limit(1);

    const otpRecord = otpRecords?.[0];

    if (fetchError || !otpRecord) {
      console.error("OTP record not found", { 
        event: "otp_not_found",
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "OTP não encontrado ou expirado" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if OTP is expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      console.error("OTP expired", { 
        event: "otp_expired",
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Código OTP expirado" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if OTP already used
    if (otpRecord.verified) {
      console.error("OTP already used", { 
        event: "otp_already_used",
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Código OTP já utilizado" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if max attempts reached
    if (otpRecord.attempts >= 3) {
      console.error("Max OTP attempts reached", { 
        event: "otp_max_attempts",
        attempts: otpRecord.attempts,
        timestamp: new Date().toISOString()
      });
      
      // Log security event
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                 req.headers.get('x-real-ip') || 
                 'unknown';
      
      await supabaseClient.rpc('log_security_event', {
        p_event_type: 'otp_max_attempts',
        p_severity: 'high',
        p_ip_address: ip,
        p_user_agent: req.headers.get('user-agent'),
        p_endpoint: '/functions/v1/verify-signup-otp',
        p_details: { phone_masked: phone.substring(0, 5) + '***', attempts: otpRecord.attempts }
      });
      
      return new Response(
        JSON.stringify({ 
          error: "Máximo de tentativas excedido. Solicite um novo código OTP.",
          max_attempts_reached: true
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify OTP code
    console.log("OTP comparison", {
      event: "otp_compare",
      stored_length: otpRecord.otp_code?.length,
      received_length: otp_code?.length,
      stored_first: otpRecord.otp_code?.substring(0, 2),
      received_first: otp_code?.substring(0, 2),
      timestamp: new Date().toISOString()
    });
    
    if (otpRecord.otp_code !== otp_code) {
      // Increment attempts counter
      const newAttempts = (otpRecord.attempts || 0) + 1;
      await supabaseClient
        .from("phone_otp_verifications")
        .update({ attempts: newAttempts })
        .eq("phone_number", phone);
      
      console.error("Invalid OTP code", { 
        event: "otp_invalid",
        attempts: newAttempts,
        remaining: 3 - newAttempts,
        stored_length: otpRecord.otp_code?.length,
        received_length: otp_code?.length,
        timestamp: new Date().toISOString()
      });
      
      const remainingAttempts = 3 - newAttempts;
      const errorMessage = remainingAttempts > 0
        ? `Código OTP inválido. ${remainingAttempts} tentativa(s) restante(s).`
        : "Máximo de tentativas excedido. Solicite um novo código OTP.";
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          remaining_attempts: Math.max(0, remainingAttempts)
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Mark OTP as verified
    const { error: updateError } = await supabaseClient
      .from("phone_otp_verifications")
      .update({ 
        verified: true,
        verified_at: new Date().toISOString()
      })
      .eq("phone_number", phone);

    if (updateError) {
      console.error("Failed to mark OTP as verified", { 
        event: "otp_update_error",
        error: updateError.message,
        timestamp: new Date().toISOString()
      });
      throw updateError;
    }

    console.log("OTP verification successful", { 
      event: "otp_verify_success",
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "OTP verificado com sucesso"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("OTP verification failed", { 
      event: "otp_verify_error",
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
