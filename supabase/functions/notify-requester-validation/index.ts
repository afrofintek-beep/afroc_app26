import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const notifySchema = z.object({
  witness_id: z.string().uuid("Invalid witness ID format"),
});

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

    const body = await req.json();
    
    // Validate input
    const validationResult = notifySchema.safeParse(body);
    if (!validationResult.success) {
      console.error("Invalid input", {
        event: "validation_error",
        errors: validationResult.error.issues,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Invalid request parameters" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { witness_id } = validationResult.data;

    console.log("Notifying requester of validation response", {
      event: "notify_requester_start",
      witness_id,
      timestamp: new Date().toISOString()
    });

    // Get witness details
    const { data: witness, error: witnessError } = await supabaseClient
      .from("afroloc_witnesses")
      .select(`
        id,
        status,
        witness_afro_id,
        afroloc_record_id,
        afroloc_records (
          code,
          geo_lat,
          geo_lon,
          user_id
        )
      `)
      .eq("id", witness_id)
      .single();

    if (witnessError || !witness) {
      console.error("Data retrieval failed", {
        event: "data_error",
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Request processing failed" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const requesterUserId = witness.afroloc_records[0]?.user_id;
    
    // Get requester email
    const { data: requesterUser } = await supabaseAdmin.auth.admin.getUserById(requesterUserId);
    const requesterEmail = requesterUser?.user?.email;

    if (!requesterEmail) {
      console.warn("Requester email not found", { requesterUserId });
      return new Response(
        JSON.stringify({ success: false, message: "Unable to send notification" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build address with geo coordinates
    const afrolocRecord = witness.afroloc_records[0];
    const geoCoords = afrolocRecord?.geo_lat && afrolocRecord?.geo_lon
      ? `(${afrolocRecord.geo_lat}, ${afrolocRecord.geo_lon})`
      : "";
    const address = geoCoords 
      ? `${afrolocRecord?.code} ${geoCoords}`
      : afrolocRecord?.code;

    const statusText = witness.status === "confirmed" ? "CONFIRMADA" : "REJEITADA";
    const statusColor = witness.status === "confirmed" ? "#22c55e" : "#ef4444";

    // Send email notification
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, message: "Service configuration error" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AFROLOC <onboarding@resend.dev>",
        to: [requesterEmail],
        subject: `Testemunha Respondeu: ${statusText}`,
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
                .status-box { background: white; border-left: 4px solid ${statusColor}; padding: 20px; margin: 20px 0; border-radius: 8px; }
                .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🌍 AFROLOC</h1>
                  <p>Resposta de Testemunha</p>
                </div>
                <div class="content">
                  <h2>Testemunha Respondeu!</h2>
                  <p>A testemunha respondeu à sua solicitação de validação:</p>
                  
                  <div class="status-box">
                    <p style="margin: 0 0 10px 0; font-weight: bold;">Status:</p>
                    <p style="margin: 0; font-size: 24px; color: ${statusColor}; font-weight: bold;">${statusText}</p>
                  </div>
                  
                  <p><strong>Endereço AFROLOC:</strong> ${address}</p>
                  <p><strong>Testemunha:</strong> ${witness.witness_afro_id}</p>
                  
                  <p style="margin-top: 20px;">
                    Você pode visualizar todos os detalhes no seu painel AFROLOC.
                  </p>
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
        event: "email_error",
        status: emailResponse.status,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ success: false, message: "Notification delivery failed" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Requester notified successfully", {
      event: "notify_requester_success",
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Notification failed", {
      event: "notify_error",
      error: error.message,
      timestamp: new Date().toISOString()
    });
    return new Response(
      JSON.stringify({ error: "Request processing failed" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
