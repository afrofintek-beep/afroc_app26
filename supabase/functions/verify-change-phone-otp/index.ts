import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/auth_rbac.ts";
import { sendSms } from "../_shared/sms.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const verifyOTPSchema = z.object({
  new_phone: z.string()
    .trim()
    .min(10, "Phone number must be at least 10 digits")
    .max(20, "Phone number must be less than 20 characters"),
  otp_code: z.string()
    .trim()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d{6}$/, "OTP must contain only digits"),
});

async function sendChangeNotifications(
  userEmail: string,
  oldPhone: string,
  newPhone: string,
  userName: string
): Promise<void> {
  const timestamp = new Date().toLocaleString('pt-PT', {
    timeZone: 'Africa/Luanda',
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  try {
    // Send SMS to old phone number
    if (oldPhone) {
      const oldPhoneSms = await sendSms(
        oldPhone,
        `AFROLOC: Seu número de telefone foi alterado em ${timestamp}. Se não foi você, entre em contato imediatamente com o suporte.`
      );
      if (!oldPhoneSms.ok) {
        console.error("SMS send failed (Infobip)", { error: oldPhoneSms.error });
        throw new Error("Falha ao enviar SMS. " + (oldPhoneSms.error ?? "Tente novamente."));
      }
      console.log("SMS sent to old phone", {
        event: "old_phone_sms_sent",
        timestamp: new Date().toISOString()
      });
    }

    // Send SMS to new phone number
    const newPhoneSms = await sendSms(
      newPhone,
      `AFROLOC: Seu número de telefone foi atualizado com sucesso em ${timestamp}. Todos os seus endereços AFROLOC foram mantidos.`
    );
    if (!newPhoneSms.ok) {
      console.error("SMS send failed (Infobip)", { error: newPhoneSms.error });
      throw new Error("Falha ao enviar SMS. " + (newPhoneSms.error ?? "Tente novamente."));
    }
    console.log("SMS sent to new phone", {
      event: "new_phone_sms_sent",
      timestamp: new Date().toISOString()
    });

    // Send email notification
    if (userEmail) {
      await resend.emails.send({
        from: "AFROLOC <onboarding@resend.dev>",
        to: [userEmail],
        subject: "Número de Telefone Alterado - AFROLOC",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Alteração de Número de Telefone</h2>
            <p>Olá ${userName},</p>
            <p>Seu número de telefone foi alterado com sucesso em <strong>${timestamp}</strong>.</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Número Anterior:</strong> ${oldPhone ? oldPhone.substring(0, 5) + '***' + oldPhone.slice(-2) : 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Novo Número:</strong> ${newPhone.substring(0, 5) + '***' + newPhone.slice(-2)}</p>
            </div>
            <p><strong>Todos os seus endereços AFROLOC foram mantidos</strong> e continuam associados à sua conta.</p>
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>⚠️ Se você não fez esta alteração:</strong></p>
              <p style="margin: 5px 0 0 0;">Entre em contato imediatamente com nosso suporte em suporte@afroloc.com</p>
            </div>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              Este é um email automático de segurança. Não responda a este email.
            </p>
          </div>
        `,
      });
      console.log("Email notification sent", {
        event: "email_notification_sent",
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Error sending notifications", {
      event: "notification_error",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
    // Don't throw - notifications are not critical to the phone change
  }
}

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
    
    // Validate input
    const validationResult = verifyOTPSchema.safeParse(body);
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

    const { new_phone, otp_code } = validationResult.data;

    console.log("Change phone OTP verification initiated", {
      event: "change_phone_verify_start",
      user_id: user.id,
      new_phone: new_phone.substring(0, 5) + "***",
      timestamp: new Date().toISOString()
    });

    // Get IP address for logging
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      req.headers.get('x-real-ip') || 
                      'unknown';

    // Check rate limiting for verification attempts (3 attempts per 10 minutes)
    const { data: withinRateLimit } = await supabaseClient
      .rpc('check_phone_change_rate_limit', {
        p_user_id: user.id,
        p_attempt_type: 'otp_verify',
        p_max_attempts: 3,
        p_time_window_minutes: 10
      });

    if (!withinRateLimit) {
      console.warn("Verification rate limit exceeded", {
        event: "verify_rate_limit_exceeded",
        user_id: user.id,
        timestamp: new Date().toISOString()
      });

      return new Response(
        JSON.stringify({ 
          error: "Muitas tentativas de verificação. Tente novamente em 10 minutos.",
          rate_limit_exceeded: true
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Log this verification attempt
    await supabaseClient.rpc('log_phone_change_attempt', {
      p_user_id: user.id,
      p_attempt_type: 'otp_verify',
      p_phone_number: new_phone,
      p_ip_address: ipAddress
    });

    // Get old phone number and user email before change
    const { data: profileData } = await supabaseClient
      .from('profiles')
      .select('phone, full_name')
      .eq('user_id', user.id)
      .single();

    const oldPhone = profileData?.phone;
    const userName = profileData?.full_name || 'Usuário';

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

    // Get most recent OTP record
    const { data: otpRecords, error: fetchError } = await supabaseClient
      .from("phone_otp_verifications")
      .select("*")
      .eq("phone_number", new_phone)
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
    if (otpRecord.otp_code !== otp_code) {
      // Increment attempts counter
      const newAttempts = (otpRecord.attempts || 0) + 1;
      await supabaseClient
        .from("phone_otp_verifications")
        .update({ attempts: newAttempts })
        .eq("phone_number", new_phone);
      
      console.error("Invalid OTP code", {
        event: "otp_invalid",
        attempts: newAttempts,
        remaining: 3 - newAttempts,
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
    const { error: updateOtpError } = await supabaseClient
      .from("phone_otp_verifications")
      .update({ 
        verified: true,
        verified_at: new Date().toISOString()
      })
      .eq("phone_number", new_phone);

    if (updateOtpError) {
      console.error("Failed to mark OTP as verified", {
        event: "otp_update_error",
        error: updateOtpError.message,
        timestamp: new Date().toISOString()
      });
      throw updateOtpError;
    }

    // Update user's phone number in profile and set last_phone_change_at
    const { error: updateProfileError } = await supabaseClient
      .from("profiles")
      .update({ 
        phone: new_phone,
        last_phone_change_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    if (updateProfileError) {
      console.error("Failed to update phone number", {
        event: "profile_update_error",
        error: updateProfileError.message,
        timestamp: new Date().toISOString()
      });
      throw updateProfileError;
    }

    // Log security event for phone number change
    await supabaseClient.rpc('log_security_event', {
      p_event_type: 'phone_change',
      p_severity: 'medium',
      p_user_id: user.id,
      p_ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                    req.headers.get('x-real-ip') || 
                    'unknown',
      p_user_agent: req.headers.get('user-agent'),
      p_endpoint: '/functions/v1/verify-change-phone-otp',
      p_details: { 
        old_phone_masked: oldPhone?.substring(0, 5) + '***',
        new_phone_masked: new_phone.substring(0, 5) + '***',
        success: true 
      }
    });

    console.log("Phone number changed successfully", {
      event: "phone_change_success",
      user_id: user.id,
      timestamp: new Date().toISOString()
    });

    // Send notifications (non-blocking - don't await)
    sendChangeNotifications(
      user.email || '',
      oldPhone || '',
      new_phone,
      userName
    ).catch(error => {
      console.error("Failed to send notifications", {
        error: error instanceof Error ? error.message : String(error)
      });
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Número de telefone atualizado com sucesso"
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
    console.error("Change phone verification failed", {
      event: "change_phone_verify_error",
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
