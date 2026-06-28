import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

interface AlertRequest {
  userId: string;
  alertType: 'high_risk' | 'critical_risk' | 'trend_increase';
  riskScore: number;
  regionName?: string;
  countryCode?: string;
  afrolocCode: string;
  message: string;
  sendVia: 'email' | 'sms' | 'both';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { userId, alertType, riskScore, regionName, countryCode, afrolocCode, message, sendVia }: AlertRequest = await req.json();

    console.log(`Processing risk alert for user ${userId}, type: ${alertType}, score: ${riskScore}`);

    // Get user details
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, phone, user_id')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error(`Failed to fetch user profile: ${profileError?.message}`);
    }

    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    
    if (authError || !authUser) {
      throw new Error(`Failed to fetch auth user: ${authError?.message}`);
    }

    const userEmail = authUser.user.email;
    const userName = profile.full_name || 'Usuário';
    const userPhone = profile.phone;

    let emailSent = false;
    let smsSent = false;

    // Send email
    if ((sendVia === 'email' || sendVia === 'both') && userEmail) {
      try {
        const emailSubject = alertType === 'critical_risk' 
          ? '🚨 Alerta Crítico de Risco - AFROLOC'
          : alertType === 'high_risk'
          ? '⚠️ Alerta de Risco Alto - AFROLOC'
          : '📈 Alerta de Tendência de Risco - AFROLOC';

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: ${alertType === 'critical_risk' ? '#dc2626' : '#f59e0b'};">
              ${emailSubject}
            </h1>
            <p>Olá ${userName},</p>
            <p>${message}</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Detalhes do Alerta:</h3>
              <ul style="list-style: none; padding: 0;">
                <li><strong>AFROLOC:</strong> ${afrolocCode}</li>
                <li><strong>Score de Risco:</strong> ${riskScore}/100</li>
                ${regionName ? `<li><strong>Região:</strong> ${regionName}</li>` : ''}
                ${countryCode ? `<li><strong>País:</strong> ${countryCode}</li>` : ''}
              </ul>
            </div>
            <p><strong>Ação Recomendada:</strong></p>
            <ul>
              <li>Acesse seu painel AFROLOC imediatamente</li>
              <li>Verifique o status de verificação do endereço</li>
              <li>Agende verificação se necessário</li>
            </ul>
            <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">
              Este é um alerta automático do sistema AFROLOC. Para mais informações, entre em contato com o suporte.
            </p>
          </div>
        `;

        await resend.emails.send({
          from: "AFROLOC Alerts <alerts@resend.dev>",
          to: [userEmail],
          subject: emailSubject,
          html: emailHtml,
        });

        emailSent = true;
        console.log(`Email alert sent to ${userEmail}`);
      } catch (error: unknown) {
        const err = error as Error;
        console.error(`Failed to send email: ${err.message}`);
      }
    }

    // Send SMS
    if ((sendVia === 'sms' || sendVia === 'both') && userPhone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      try {
        const smsMessage = `${alertType === 'critical_risk' ? '🚨 CRÍTICO' : '⚠️ ALERTA'}: Score ${riskScore} para ${afrolocCode}. Acesse seu painel AFROLOC imediatamente.`;
        
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${twilioAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: userPhone,
            From: TWILIO_PHONE_NUMBER!,
            Body: smsMessage,
          }),
        });

        if (response.ok) {
          smsSent = true;
          console.log(`SMS alert sent to ${userPhone}`);
        } else {
          const errorData = await response.text();
          console.error(`Failed to send SMS: ${errorData}`);
        }
      } catch (error: unknown) {
        const err = error as Error;
        console.error(`Failed to send SMS: ${err.message}`);
      }
    }

    // Log the alert
    const { error: logError } = await supabase
      .from('risk_alerts_log')
      .insert({
        user_id: userId,
        alert_type: alertType,
        risk_score: riskScore,
        region_name: regionName,
        country_code: countryCode,
        message,
        sent_via: sendVia,
        metadata: {
          afroloc_code: afrolocCode,
          email_sent: emailSent,
          sms_sent: smsSent,
        },
      });

    if (logError) {
      console.error(`Failed to log alert: ${logError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailSent, 
        smsSent,
        message: 'Alert processed successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-risk-alert function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
