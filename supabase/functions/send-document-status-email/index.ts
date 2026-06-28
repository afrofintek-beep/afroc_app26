import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface DocumentStatusEmailRequest {
  user_email: string;
  afroloc_code: string;
  document_type: string;
  status: "verified" | "rejected";
  rejection_reason?: string;
}

const getDocumentTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    national_id: "National ID Card",
    utility_bill: "Utility Bill",
    residence_certificate: "Residence Certificate",
    property_deed: "Property Deed/Lease",
  };
  return labels[type] || type;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_email, afroloc_code, document_type, status, rejection_reason }: DocumentStatusEmailRequest = await req.json();

    console.log(`Sending ${status} email for ${document_type} to ${user_email}`);

    const documentLabel = getDocumentTypeLabel(document_type);
    const subject = status === "verified" 
      ? `Document Approved - ${afroloc_code}`
      : `Document Rejected - ${afroloc_code}`;

    const html = status === "verified" ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #16a34a;">Document Approved ✓</h1>
        <p>Great news! Your document has been approved.</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>AFROLOC:</strong> ${afroloc_code}</p>
          <p style="margin: 5px 0;"><strong>Document Type:</strong> ${documentLabel}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #16a34a;">Verified</span></p>
        </div>
        
        <p>Your document has been reviewed and approved by our verification team.</p>
        <p>You can now proceed with your identity verification process.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">
          If you have any questions, please contact our support team.
        </p>
      </div>
    ` : `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc2626;">Document Rejected</h1>
        <p>Unfortunately, your document submission has been rejected.</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>AFROLOC:</strong> ${afroloc_code}</p>
          <p style="margin: 5px 0;"><strong>Document Type:</strong> ${documentLabel}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #dc2626;">Rejected</span></p>
        </div>
        
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold;">Rejection Reason:</p>
          <p style="margin: 10px 0 0 0;">${rejection_reason || "No reason provided"}</p>
        </div>
        
        <p>Please review the rejection reason above and submit a new document that addresses the issue.</p>
        <p>You can upload a new document through your account dashboard.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">
          If you have any questions about the rejection, please contact our support team.
        </p>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: "AFROLOC <onboarding@resend.dev>",
      to: [user_email],
      subject: subject,
      html: html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-document-status-email function:", error);
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
