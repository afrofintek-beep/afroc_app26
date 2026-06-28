import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface FraudAlertRequest {
  flag_id: string;
  witness_user_id: string;
  flag_type: string;
  severity: string;
  description: string;
  afroloc_code?: string;
  region_name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-fraud-alert-email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      flag_id, 
      witness_user_id, 
      flag_type, 
      severity, 
      description,
      afroloc_code,
      region_name 
    }: FraudAlertRequest = await req.json();

    console.log(`Processing fraud alert for flag: ${flag_id}, severity: ${severity}`);

    // Get all admin users to notify
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError) {
      console.error("Error fetching admin roles:", rolesError);
      throw rolesError;
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.log("No admin users found to notify");
      return new Response(
        JSON.stringify({ success: true, message: "No admins to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get admin emails from auth.users
    const adminUserIds = adminRoles.map(r => r.user_id);
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw usersError;
    }

    const adminEmails = users
      .filter(user => adminUserIds.includes(user.id) && user.email)
      .map(user => user.email!);

    if (adminEmails.length === 0) {
      console.log("No admin emails found");
      return new Response(
        JSON.stringify({ success: true, message: "No admin emails found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get witness info
    const { data: witnessProfile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", witness_user_id)
      .single();

    const witnessName = witnessProfile?.full_name || "Desconhecido";
    const witnessPhone = witnessProfile?.phone || "-";

    // Format flag type for display
    const flagTypeLabels: Record<string, string> = {
      rapid_confirmations: "Confirmações Rápidas Suspeitas",
      cross_region: "Atividade em Múltiplas Regiões",
      collusion: "Possível Conluio"
    };

    const flagTypeLabel = flagTypeLabels[flag_type] || flag_type;

    // Severity colors for email
    const severityColors: Record<string, string> = {
      critical: "#dc2626",
      high: "#ea580c",
      medium: "#eab308",
      low: "#3b82f6"
    };

    const severityLabels: Record<string, string> = {
      critical: "CRÍTICO",
      high: "ALTO",
      medium: "MÉDIO",
      low: "BAIXO"
    };

    const severityColor = severityColors[severity] || "#6b7280";
    const severityLabel = severityLabels[severity] || severity.toUpperCase();

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background-color: ${severityColor}; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">⚠️ Alerta de Fraude Detectado</h1>
      <span style="display: inline-block; background-color: rgba(255,255,255,0.2); color: #ffffff; padding: 4px 12px; border-radius: 4px; margin-top: 8px; font-weight: bold;">
        ${severityLabel}
      </span>
    </div>
    
    <!-- Content -->
    <div style="padding: 24px;">
      <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 18px;">${flagTypeLabel}</h2>
      
      <p style="color: #52525b; margin: 0 0 24px 0; line-height: 1.6;">
        ${description}
      </p>
      
      <!-- Details Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 12px; background-color: #f4f4f5; border-bottom: 1px solid #e4e4e7; font-weight: 600; color: #71717a; width: 140px;">Testemunha</td>
          <td style="padding: 12px; background-color: #fafafa; border-bottom: 1px solid #e4e4e7; color: #18181b;">${witnessName}</td>
        </tr>
        <tr>
          <td style="padding: 12px; background-color: #f4f4f5; border-bottom: 1px solid #e4e4e7; font-weight: 600; color: #71717a;">Telefone</td>
          <td style="padding: 12px; background-color: #fafafa; border-bottom: 1px solid #e4e4e7; color: #18181b;">${witnessPhone}</td>
        </tr>
        ${afroloc_code ? `
        <tr>
          <td style="padding: 12px; background-color: #f4f4f5; border-bottom: 1px solid #e4e4e7; font-weight: 600; color: #71717a;">Código AFROLOC</td>
          <td style="padding: 12px; background-color: #fafafa; border-bottom: 1px solid #e4e4e7; color: #18181b; font-family: monospace;">${afroloc_code}</td>
        </tr>
        ` : ''}
        ${region_name ? `
        <tr>
          <td style="padding: 12px; background-color: #f4f4f5; border-bottom: 1px solid #e4e4e7; font-weight: 600; color: #71717a;">Região</td>
          <td style="padding: 12px; background-color: #fafafa; border-bottom: 1px solid #e4e4e7; color: #18181b;">${region_name}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 12px; background-color: #f4f4f5; font-weight: 600; color: #71717a;">Data/Hora</td>
          <td style="padding: 12px; background-color: #fafafa; color: #18181b;">${new Date().toLocaleString('pt-BR', { timeZone: 'Africa/Luanda' })}</td>
        </tr>
      </table>
      
      <!-- CTA Button -->
      <div style="text-align: center;">
        <a href="${supabaseUrl.replace('.supabase.co', '')}/admin/fraud-flags" 
           style="display: inline-block; background-color: #d4a574; color: #1a1a1a; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">
          Ver Detalhes no Painel
        </a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #18181b; padding: 16px 24px; text-align: center;">
      <p style="color: #a1a1aa; margin: 0; font-size: 12px;">
        Este é um alerta automático do sistema AFROLOC. Por favor, investigue o mais rápido possível.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email to all admins
    console.log(`Sending fraud alert email to ${adminEmails.length} admins`);

    const emailResponse = await resend.emails.send({
      from: "AFROLOC <onboarding@resend.dev>",
      to: adminEmails,
      subject: `🚨 [${severityLabel}] Alerta de Fraude - ${flagTypeLabel}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    // Log the alert
    await supabase
      .from("risk_alerts_log")
      .insert({
        user_id: witness_user_id,
        alert_type: "fraud_flag_" + severity,
        risk_score: severity === "critical" ? 100 : severity === "high" ? 85 : severity === "medium" ? 70 : 50,
        region_name: region_name || null,
        message: `Alerta de fraude enviado por email: ${description}`,
        sent_via: "email",
        metadata: {
          flag_id,
          flag_type,
          afroloc_code,
          admins_notified: adminEmails.length
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        emails_sent: adminEmails.length,
        email_response: emailResponse 
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: unknown) {
    console.error("Error in send-fraud-alert-email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
};

serve(handler);
