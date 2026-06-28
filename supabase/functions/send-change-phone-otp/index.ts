import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const sendOTPSchema = z.object({
  new_phone: z.string()
    .trim()
    .min(10, "Número de telefone deve ter pelo menos 10 dígitos")
    .max(20, "Número de telefone deve ter menos de 20 caracteres")
    .regex(/^\+?[1-9]\d{9,14}$/, "Formato inválido. Use o formato internacional: +244912345678")
    .refine(
      (phone) => phone.startsWith('+'),
      { message: "Número deve começar com + e código do país (exemplo: +244912345678)" }
    ),
});

const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get IP address for rate limiting
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      req.headers.get('x-real-ip') || 
                      'unknown';

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

    // Verify user session
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body = await req.json();
    
    // Sanitize phone number before validation
    if (body.new_phone && typeof body.new_phone === 'string') {
      // Remove all + signs
      let cleanedPhone = body.new_phone.replace(/\+/g, '');
      // Remove any non-digit characters
      cleanedPhone = cleanedPhone.replace(/\D/g, '');
      // Add back single + at the beginning if we have digits
      if (cleanedPhone.length > 0) {
        body.new_phone = '+' + cleanedPhone;
      }
    }
    
    // Validate input
    const validationResult = sendOTPSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: "Entrada inválida", 
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

    const { new_phone } = validationResult.data;

    console.log("Change phone OTP generation initiated", {
      event: "change_phone_otp_start",
      user_id: user.id,
      new_phone: new_phone.substring(0, 5) + "***",
      timestamp: new Date().toISOString()
    });

    // Check 60-day cooldown period
    const { data: canChange, error: cooldownError } = await supabaseClient
      .rpc('can_change_phone_number', { p_user_id: user.id });

    if (cooldownError) {
      console.error("Error checking cooldown", {
        event: "cooldown_check_error",
        error: cooldownError.message,
        timestamp: new Date().toISOString()
      });
    }

    if (!canChange) {
      // Get days remaining in cooldown
      const { data: daysRemaining } = await supabaseClient
        .rpc('get_phone_change_cooldown_days', { p_user_id: user.id });

      console.warn("Phone change cooldown active", {
        event: "cooldown_active",
        user_id: user.id,
        days_remaining: daysRemaining,
        timestamp: new Date().toISOString()
      });

      return new Response(
        JSON.stringify({ 
          error: "Período de espera ativo",
          cooldown_active: true,
          days_remaining: daysRemaining || 0,
          message: `Você pode alterar seu número novamente em ${daysRemaining || 0} dias. Esta restrição protege sua conta contra alterações não autorizadas.`
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check rate limiting (5 attempts per hour)
    const { data: withinRateLimit } = await supabaseClient
      .rpc('check_phone_change_rate_limit', {
        p_user_id: user.id,
        p_attempt_type: 'otp_request',
        p_max_attempts: 5,
        p_time_window_minutes: 60
      });

    if (!withinRateLimit) {
      console.warn("Rate limit exceeded", {
        event: "rate_limit_exceeded",
        user_id: user.id,
        attempt_type: 'otp_request',
        timestamp: new Date().toISOString()
      });

      return new Response(
        JSON.stringify({ 
          error: "Muitas tentativas. Tente novamente em 1 hora.",
          rate_limit_exceeded: true
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Log this attempt
    await supabaseClient.rpc('log_phone_change_attempt', {
      p_user_id: user.id,
      p_attempt_type: 'otp_request',
      p_phone_number: new_phone,
      p_ip_address: ipAddress
    });

    // Check if new phone is already in use by another user
    const { data: existingProfile } = await supabaseClient
      .from('profiles')
      .select('user_id')
      .eq('phone', new_phone)
      .maybeSingle();

    if (existingProfile && existingProfile.user_id !== user.id) {
      console.error("Phone already in use", {
        event: "phone_already_in_use",
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Este número de telefone já está em uso por outra conta" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate phone number with telecom operator detection
    const { data: operatorData, error: operatorError } = await supabaseClient
      .rpc('get_telecom_operator_by_phone', { 
        phone_number: new_phone 
      });

    if (operatorError || !operatorData || operatorData.length === 0) {
      console.error("Phone operator validation failed", {
        event: "operator_validation_failed",
        error: operatorError?.message,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ 
          error: "Número de telefone inválido. Verifique e tente novamente." 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const operator = operatorData[0];
    console.log("Phone operator detected", {
      event: "operator_detected",
      operator: operator.operator_name,
      country: operator.country_code,
      timestamp: new Date().toISOString()
    });

    // Generate OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP with user_id to track who's changing phone
    const { error: insertError } = await supabaseClient
      .from("phone_otp_verifications")
      .upsert({
        phone_number: new_phone,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        verified: false,
        operator_name: operator.operator_name,
        operator_code: operator.operator_code,
        country_code: operator.country_code,
      }, {
        onConflict: 'phone_number'
      });

    if (insertError) {
      console.error("Database insert failed", {
        event: "db_error",
        error: insertError.message,
        timestamp: new Date().toISOString()
      });
      throw insertError;
    }

    // Send SMS via Twilio
    try {
      const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        throw new Error("Twilio credentials not configured");
      }

      const smsMessage = `Seu código de verificação para alteração de telefone AFROLOC: ${otpCode}. Válido por 10 minutos. Não compartilhe este código.`;
      
      const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
      
      const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");
      const senderIdSupported = ['AO', 'CD', 'ZA', 'KE', 'NG', 'GH', 'MZ', 'ZM', 'ZW'];
      const useAlphanumericSender = senderIdSupported.includes(operator.country_code);
      
      const smsParams: Record<string, string> = {
        To: new_phone,
        Body: smsMessage,
      };
      
      if (messagingServiceSid) {
        smsParams.MessagingServiceSid = messagingServiceSid;
      } else if (useAlphanumericSender) {
        smsParams.From = "AFROLOC";
      } else {
        smsParams.From = twilioPhoneNumber;
      }
      
      const smsResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${twilioAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(smsParams).toString(),
        }
      );

      if (!smsResponse.ok) {
        const errorData = await smsResponse.json();
        console.error("SMS send failed", {
          event: "sms_send_error",
          error: errorData,
          timestamp: new Date().toISOString()
        });
        throw new Error("Falha ao enviar SMS. Tente novamente.");
      }

      console.log("SMS sent successfully", {
        event: "sms_sent",
        timestamp: new Date().toISOString()
      });
    } catch (smsError) {
      const errorMessage = smsError instanceof Error ? smsError.message : String(smsError);
      console.error("SMS exception", {
        event: "sms_exception",
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
      throw new Error(errorMessage);
    }

    console.log("Change phone OTP process completed", {
      event: "change_phone_otp_complete",
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "OTP enviado com sucesso",
        expires_at: expiresAt.toISOString(),
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
    console.error("Change phone OTP generation failed", {
      event: "change_phone_otp_error",
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
