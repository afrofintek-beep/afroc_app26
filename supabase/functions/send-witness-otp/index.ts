import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const sendOTPSchema = z.object({
  witness_id: z.string().uuid("Invalid witness ID format"),
  witness_user_id: z.string().uuid("Invalid witness user ID format"),
  afroloc_code: z.string()
    .trim()
    .min(1, "AFROLOC code cannot be empty")
    .max(100, "AFROLOC code must be less than 100 characters"),
});

const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Create admin client to access auth.users
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
    
    // Rate limiting - IP based (10 per hour)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               req.headers.get('x-real-ip') || 
               'unknown';
    
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data: recentAttempts } = await supabaseClient
      .from('security_events')
      .select('id')
      .eq('event_type', 'witness_otp_request')
      .eq('ip_address', ip)
      .eq('endpoint', '/functions/v1/send-witness-otp')
      .gte('created_at', oneHourAgo);
    
    if (recentAttempts && recentAttempts.length >= 10) {
      // Log rate limit violation
      await supabaseClient.rpc('log_security_event', {
        p_event_type: 'rate_limit',
        p_severity: 'medium',
        p_ip_address: ip,
        p_user_agent: req.headers.get('user-agent'),
        p_endpoint: '/functions/v1/send-witness-otp',
        p_details: { limit: 10, period: '1 hour' }
      });
      
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body = await req.json();
    
    // Validate input
    const validationResult = sendOTPSchema.safeParse(body);
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

    const { witness_id, witness_user_id, afroloc_code } = validationResult.data;
    
    // Log witness OTP request
    await supabaseClient.rpc('log_security_event', {
      p_event_type: 'witness_otp_request',
      p_severity: 'info',
      p_ip_address: ip,
      p_user_agent: req.headers.get('user-agent'),
      p_endpoint: '/functions/v1/send-witness-otp',
      p_details: { witness_id: witness_id.substring(0, 8) + '***' }
    });

    console.log("OTP generation initiated", {
      event: "otp_generation_start",
      timestamp: new Date().toISOString()
    });

    // Get the AFRO ID record to determine administrative division
    const { data: afrolocRecord } = await supabaseClient
      .from("afroloc_records")
      .select("country, level1_code, level2_code, level3_code, level4_code")
      .eq("code", afroloc_code)
      .single();

    if (!afrolocRecord) {
      console.error("AFRO ID record not found", { 
        event: "afroloc_not_found",
        afroloc_code,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Request processing failed. Please verify your information." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get pre-allocated validation number for this address (the TO number)
    const { data: validationData, error: validationError } = await supabaseClient
      .rpc('get_validation_number_for_address', {
        p_country_code: afrolocRecord.country,
        p_level1_code: afrolocRecord.level1_code,
        p_level2_code: afrolocRecord.level2_code,
        p_level3_code: afrolocRecord.level3_code,
        p_level4_code: afrolocRecord.level4_code
      });

    if (validationError || !validationData || validationData.length === 0) {
      console.error("No validation number found for this address", {
        event: "validation_number_not_found",
        error: validationError?.message,
        country: afrolocRecord.country,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Service unavailable for this region. Please contact support." }),
        {
          status: 503,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const validationNumber = validationData[0].phone_number;
    const divisionInfo = {
      name: validationData[0].division_name,
      level: validationData[0].division_level
    };
    const validatorUserId = validationData[0].validator_user_id;

    // Get full AFRO ID record for address details
    const { data: fullAfrolocRecord } = await supabaseClient
      .from("afroloc_records")
      .select("code, geo_lat, geo_lon")
      .eq("code", afroloc_code)
      .single();

    // Get witness profile for personalization
    const { data: witnessProfile } = await supabaseClient
      .from("profiles")
      .select("full_name")
      .eq("user_id", witness_user_id)
      .single();

    if (!witnessProfile) {
      console.error("Witness profile not found", { 
        event: "witness_profile_not_found",
        witness_user_id,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Request processing failed. Please verify your information." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const witnessName = witnessProfile?.full_name || "um usuário";

    // CRITICAL SECURITY: Validate that witness has validated address
    const { data: witnessRecord, error: witnessRecordError } = await supabaseClient
      .from("afroloc_records")
      .select("id, status, code")
      .eq("user_id", witness_user_id)
      .in("status", ["verified", "certified"])
      .maybeSingle();

    if (witnessRecordError || !witnessRecord) {
      console.error("Witness AFRO ID not found or not active", { 
        event: "witness_record_error",
        error: witnessRecordError?.message,
        witness_user_id,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Validation requirements not met. Please verify eligibility." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate that witness has address validations
    const { data: witnessValidations, error: validationCheckError } = await supabaseClient
      .from("afroloc_validations")
      .select("id, validation_method")
      .eq("afroloc_record_id", witnessRecord.id)
      .in("validation_method", ["authority", "witness"]);

    if (validationCheckError || !witnessValidations || witnessValidations.length === 0) {
      console.error("Witness address not validated", { 
        event: "witness_validation_missing",
        error: validationCheckError?.message,
        witness_record_id: witnessRecord.id,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ 
          error: "Validation requirements not met. Please verify eligibility." 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Sending OTP to regional validation number", { 
      event: "validation_number_selected",
      division: divisionInfo.name,
      level: divisionInfo.level,
      timestamp: new Date().toISOString()
    });

    // Get validator email for notification
    let validatorEmail: string | null = null;
    if (validatorUserId) {
      const { data: validatorUser } = await supabaseAdmin.auth.admin.getUserById(validatorUserId);
      validatorEmail = validatorUser?.user?.email || null;
    }

    // Generate OTP for backward compatibility (not used in SMS)
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Store validation phone number as OTP (for SMS response matching)
    const { error: updateError } = await supabaseClient
      .from("afroloc_witnesses")
      .update({
        otp_code: validationNumber, // Store phone for matching responses
        otp_expires_at: expiresAt.toISOString(),
        otp_sent_at: new Date().toISOString(),
      })
      .eq("id", witness_id);

    if (updateError) {
      console.error("Database update failed", { 
        event: "db_error",
        timestamp: new Date().toISOString()
      });
      throw updateError;
    }

    console.log("OTP saved, sending notifications", { 
      event: "otp_notification_start",
      timestamp: new Date().toISOString()
    });

    // Send OTP via Email to regional validator
    try {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey || !validatorEmail) {
        console.warn("RESEND_API_KEY not configured or no validator email, skipping email");
      } else {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "AFROLOC <onboarding@resend.dev>",
            to: [validatorEmail],
            subject: "Solicitação de Validação Regional AFROLOC",
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="UTF-8">
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                    .otp-box { background: white; border: 2px solid #22c55e; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; }
                    .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #16a34a; }
                    .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
                    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>🌍 AFROLOC</h1>
                      <p>Validação Regional de Endereço</p>
                    </div>
                    <div class="content">
                      <h2>Solicitação de Validação - ${divisionInfo.name}</h2>
                      <p>Uma nova solicitação de validação de endereço foi recebida para sua região administrativa:</p>
                      
                      <div class="otp-box">
                        <p style="margin: 0 0 10px 0; font-weight: bold;">Código AFROLOC:</p>
                        <p style="margin: 0; font-size: 18px; font-family: monospace;">${afroloc_code}</p>
                      </div>
                      
                      <p>Para validar este endereço, use o código OTP abaixo:</p>
                      
                      <div class="otp-box">
                        <p style="margin: 0 0 10px 0; font-weight: bold;">Código OTP de Validação:</p>
                        <div class="otp-code">${otpCode}</div>
                        <p style="margin: 10px 0 0 0; font-size: 14px; color: #6b7280;">Válido por 30 minutos</p>
                      </div>
                      
                      <div class="info-box">
                        <strong>⚠️ Responsabilidades do Validador:</strong>
                        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                          <li>Verificar a autenticidade do endereço na sua jurisdição</li>
                          <li>Confirmar que o endereço corresponde à divisão administrativa correta</li>
                          <li>Validar apenas endereços legítimos</li>
                          <li>Manter a confidencialidade do código OTP</li>
                        </ul>
                      </div>
                      
                      <p><strong>Jurisdição:</strong> ${divisionInfo.name} (Nível ${divisionInfo.level})</p>
                      <p>Link para validar: ${Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "")}/confirm-witness/${witness_id}</p>
                    </div>
                    <div class="footer">
                      <p>© 2025 AFROLOC Initiative - AFROFINTEK LDA</p>
                      <p>Sistema Continental de Endereçamento Digital</p>
                    </div>
                  </div>
                </body>
              </html>
            `,
          }),
        });

        if (!emailResponse.ok) {
          console.error("Email notification failed", { 
            event: "email_send_error",
            timestamp: new Date().toISOString()
          });
        } else {
          console.log("Email notification sent", { 
            event: "email_sent",
            timestamp: new Date().toISOString()
          });
        }
      }
      } catch (emailError) {
      console.error("Email notification exception", { 
        event: "email_exception",
        timestamp: new Date().toISOString()
      });
      // Don't fail the whole request if email fails
    }

    // Send SMS via Twilio to regional validation number
    try {
      const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        console.warn("Twilio credentials not configured, skipping SMS");
      } else {
        // Update validation number usage
        await supabaseClient.rpc('update_validation_number_usage', {
          p_phone_number: validationNumber
        });

        // Detect telecom operator for the validation number
        const { data: operatorData, error: operatorError } = await supabaseClient
          .rpc('get_telecom_operator_by_phone', { phone_number: validationNumber });

        let operator = null;
        if (!operatorError && operatorData && operatorData.length > 0) {
          operator = operatorData[0];
          console.log("Detected telecom operator for validation number", { 
            event: "operator_detected",
            operator: operator.operator_name,
            provider: operator.otp_provider,
            timestamp: new Date().toISOString()
          });
        }

        // Build complete AFRO ID address with georeferencing
        const geoCoords = fullAfrolocRecord?.geo_lat && fullAfrolocRecord?.geo_lon 
          ? `(${fullAfrolocRecord.geo_lat}, ${fullAfrolocRecord.geo_lon})`
          : "";
        const address = geoCoords ? `${afroloc_code} ${geoCoords}` : afroloc_code;

        const smsMessage = `AFROLOC: ${witnessName} indicou você como testemunha para o endereço ${address}. Confirma? Responda SIM ou NÃO. Válido por 30 min.`;
        
        const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
        
        // Use Sender ID for African countries (more recognizable)
        const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");
        const senderIdSupported = ['AO', 'CD', 'ZA', 'KE', 'NG', 'GH', 'MZ', 'ZM', 'ZW'];
        const useAlphanumericSender = operator && senderIdSupported.includes(operator.country_code);
        
        const smsParams: Record<string, string> = {
          To: validationNumber,
          Body: smsMessage,
        };
        
        // Priority: Messaging Service > Alphanumeric Sender ID > Phone Number
        if (messagingServiceSid) {
          smsParams.MessagingServiceSid = messagingServiceSid;
          console.log("Using Messaging Service for witness", { 
            event: "using_messaging_service",
            timestamp: new Date().toISOString()
          });
        } else if (useAlphanumericSender) {
          smsParams.From = "AFROLOC";
          console.log("Using Alphanumeric Sender ID for witness", { 
            event: "using_sender_id",
            country: operator.country_code,
            timestamp: new Date().toISOString()
          });
        } else {
          smsParams.From = twilioPhoneNumber;
          console.log("Using phone number for witness", { 
            event: "using_phone_number",
            timestamp: new Date().toISOString()
          });
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
          console.error("SMS notification failed", { 
            event: "sms_send_error",
            operator: operator?.operator_name || 'unknown',
            validation_number: validationNumber,
            division: divisionInfo.name,
            timestamp: new Date().toISOString()
          });
        } else {
          console.log("SMS notification sent to regional validator", { 
            event: "sms_sent",
            operator: operator?.operator_name || 'unknown',
            provider: operator?.otp_provider || 'default',
            validation_number: validationNumber,
            division: divisionInfo.name,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (smsError) {
      console.error("SMS notification exception", { 
        event: "sms_exception",
        timestamp: new Date().toISOString()
      });
      // Don't fail the whole request if SMS fails
    }

    console.log("OTP process completed", { 
      event: "otp_generation_complete",
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "OTP sent successfully",
        expires_at: expiresAt.toISOString()
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
    console.error("OTP generation failed", { 
      event: "otp_generation_error",
      timestamp: new Date().toISOString()
    });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
