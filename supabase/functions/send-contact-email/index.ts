import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface ContactEmailRequest {
  name: string;
  email: string;
  phone?: string;
  region: string;
  subject: string;
  message: string;
}

const regionEmails: Record<string, string> = {
  west: "west-africa@afroloc.com",
  central: "central-africa@afroloc.com",
  east: "east-africa@afroloc.com",
  south: "south-africa@afroloc.com",
  north: "north-africa@afroloc.com"
};

const regionNames: Record<string, string> = {
  west: "África Ocidental",
  central: "África Central",
  east: "África Oriental",
  south: "África Austral",
  north: "África do Norte"
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, phone, region, subject, message }: ContactEmailRequest = await req.json();

    // Validate input
    if (!name || !email || !region || !subject || !message) {
      throw new Error("Missing required fields");
    }

    const regionName = regionNames[region] || region;
    const targetEmail = regionEmails[region] || "contact@afroloc.com";

    // Send email to user (confirmation)
    const userEmailResponse = await resend.emails.send({
      from: "AFROLOC <onboarding@resend.dev>",
      to: [email],
      subject: "Recebemos sua mensagem - AFROLOC",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; border-bottom: 2px solid #0EA5E9; padding-bottom: 10px;">
            Olá, ${name}!
          </h1>
          <p style="color: #555; line-height: 1.6;">
            Recebemos sua mensagem para a região <strong>${regionName}</strong> e nossa equipe entrará em contato em breve.
          </p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Resumo da sua solicitação:</h3>
            <p style="color: #555; margin: 5px 0;"><strong>Assunto:</strong> ${subject}</p>
            <p style="color: #555; margin: 5px 0;"><strong>Região:</strong> ${regionName}</p>
            ${phone ? `<p style="color: #555; margin: 5px 0;"><strong>Telefone:</strong> ${phone}</p>` : ''}
          </div>
          <p style="color: #555; line-height: 1.6;">
            Tempo médio de resposta: <strong>2 horas</strong>
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #888; font-size: 12px;">
            AFROLOC - Sistema Unificado de Identidade Africana<br>
            Este é um email automático, por favor não responda.
          </p>
        </div>
      `,
    });

    // Send email to support team
    const supportEmailResponse = await resend.emails.send({
      from: "AFROLOC Contact Form <onboarding@resend.dev>",
      to: [targetEmail],
      reply_to: email,
      subject: `[${regionName}] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; border-bottom: 2px solid #0EA5E9; padding-bottom: 10px;">
            Nova Mensagem de Contato
          </h1>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="color: #555; margin: 5px 0;"><strong>Nome:</strong> ${name}</p>
            <p style="color: #555; margin: 5px 0;"><strong>Email:</strong> ${email}</p>
            ${phone ? `<p style="color: #555; margin: 5px 0;"><strong>Telefone:</strong> ${phone}</p>` : ''}
            <p style="color: #555; margin: 5px 0;"><strong>Região:</strong> ${regionName}</p>
            <p style="color: #555; margin: 5px 0;"><strong>Assunto:</strong> ${subject}</p>
          </div>
          <div style="background-color: white; padding: 15px; border: 1px solid #ddd; border-radius: 5px;">
            <h3 style="color: #333; margin-top: 0;">Mensagem:</h3>
            <p style="color: #555; line-height: 1.6; white-space: pre-wrap;">${message}</p>
          </div>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #888; font-size: 12px;">
            Recebido via formulário de contato AFROLOC
          </p>
        </div>
      `,
    });

    console.log("Emails sent successfully:", { userEmailResponse, supportEmailResponse });

    return new Response(
      JSON.stringify({ 
        success: true,
        userEmailId: userEmailResponse.data?.id,
        supportEmailId: supportEmailResponse.data?.id
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
    console.error("Error in send-contact-email function:", error);
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
