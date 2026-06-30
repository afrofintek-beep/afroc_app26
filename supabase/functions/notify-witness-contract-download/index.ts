import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const notifySchema = z.object({
  witness_id: z.string().uuid("Invalid witness ID"),
  afroloc_code: z.string().min(1, "AFROLOC code is required"),
});

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    
    const validationResult = notifySchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input", 
          details: validationResult.error.issues 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { witness_id, afroloc_code } = validationResult.data;

    // Get authenticated user (who downloaded the contract)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Contract download notification", { 
      event: "contract_download_notification",
      witness_id,
      downloaded_by: user.id,
      timestamp: new Date().toISOString()
    });

    // Get witness information
    const { data: witness, error: witnessError } = await supabase
      .from("afroloc_witnesses")
      .select("*, witness_user_id")
      .eq("id", witness_id)
      .single();

    if (witnessError || !witness) {
      console.error("Failed to fetch witness", witnessError);
      return new Response(
        JSON.stringify({ error: "Witness not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get witness profile (email and phone)
    const { data: witnessProfile, error: witnessProfileError } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", witness.witness_user_id)
      .single();

    if (witnessProfileError || !witnessProfile) {
      console.error("Failed to fetch witness profile", witnessProfileError);
      return new Response(
        JSON.stringify({ error: "Witness profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get witness email from auth.users
    const { data: witnessAuthData, error: witnessAuthError } = await supabase.auth.admin.getUserById(witness.witness_user_id);
    
    if (witnessAuthError) {
      console.error("Failed to fetch witness auth data", witnessAuthError);
    }

    // Get downloader profile
    const { data: downloaderProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();

    const downloaderName = downloaderProfile?.full_name || "Identity Owner";
    const witnessEmail = witnessAuthData?.user?.email;
    const witnessPhone = witnessProfile.phone;

    const results = {
      email: { success: false, message: "" },
      whatsapp: { success: false, message: "" }
    };

    // Send Email Notification
    if (witnessEmail) {
      try {
        const emailResponse = await resend.emails.send({
          from: "AFROLOC <onboarding@resend.dev>",
          to: [witnessEmail],
          subject: "Your Witness Contract Was Downloaded",
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                  .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                  .info-box { background: white; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; }
                  .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>🔒 Contract Download Notification</h1>
                  </div>
                  <div class="content">
                    <p>Dear ${witnessProfile.full_name || 'Witness'},</p>
                    
                    <p>This is to inform you that your signed witness contract has been downloaded.</p>
                    
                    <div class="info-box">
                      <strong>Contract Details:</strong><br>
                      <strong>AFROLOC:</strong> ${afroloc_code}<br>
                      <strong>Downloaded By:</strong> ${downloaderName}<br>
                      <strong>Download Time:</strong> ${new Date().toLocaleString()}<br>
                      <strong>Your Witness ID:</strong> ${witness.witness_afro_id}
                    </div>
                    
                    <p>Your digital signature and the legal contract terms are included in the downloaded document.</p>
                    
                    <p>If you have any questions or concerns about this download, please contact AFROLOC support.</p>
                    
                    <p>Best regards,<br><strong>AFROLOC Team</strong></p>
                  </div>
                  <div class="footer">
                    <p>This is an automated notification from AFROLOC System</p>
                    <p>© ${new Date().getFullYear()} AFROLOC. All rights reserved.</p>
                  </div>
                </div>
              </body>
            </html>
          `,
        });

        console.log("Email sent successfully", { emailResponse });
        results.email = { success: true, message: "Email sent successfully" };
      } catch (emailError: any) {
        console.error("Email sending failed", emailError);
        results.email = { success: false, message: emailError.message };
      }
    }

    // Notificação móvel por WhatsApp DESATIVADA (Twilio removido).
    // A notificação passa a ser apenas por e-mail (acima). Para reativar um
    // canal móvel no futuro: usar o helper Infobip de SMS (../_shared/sms.ts)
    // ou o WhatsApp Business da Infobip (requer conta + templates aprovados).
    if (witnessPhone) {
      results.whatsapp = {
        success: false,
        message: "Canal WhatsApp desativado — notificação enviada por e-mail.",
      };
    }

    // Log the download to database
    try {
      const { error: logError } = await supabase
        .from("witness_contract_downloads")
        .insert({
          witness_id,
          afroloc_record_id: witness.afroloc_record_id,
          downloaded_by_user_id: user.id,
          witness_afro_id: witness.witness_afro_id,
          afroloc_code,
          email_sent: results.email.success,
          email_status: results.email.message,
          whatsapp_sent: results.whatsapp.success,
          whatsapp_status: results.whatsapp.message,
        });

      if (logError) {
        console.error("Failed to log download", logError);
      }
    } catch (logError) {
      console.error("Database logging error", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notification sent",
        results,
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
    console.error("Notification error", error);
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
