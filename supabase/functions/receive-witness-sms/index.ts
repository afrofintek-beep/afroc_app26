import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";

// Validate Twilio webhook signature
const validateTwilioSignature = async (
  signature: string | null,
  url: string,
  params: Record<string, string>,
  authToken: string
): Promise<boolean> => {
  if (!signature) return false;
  
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(url + Object.keys(params).sort().map(key => key + params[key]).join(''));
    const key = encoder.encode(authToken);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, data);
    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    return signature === expectedSignature;
  } catch (error) {
    console.error("Signature validation error:", error);
    return false;
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioSignature = req.headers.get("x-twilio-signature");
    
    // Parse Twilio webhook data (application/x-www-form-urlencoded)
    const formData = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }
    
    // Validate Twilio signature if auth token is configured
    if (twilioAuthToken) {
      const url = req.url;
      const isValid = await validateTwilioSignature(twilioSignature, url, params, twilioAuthToken);
      
      if (!isValid) {
        console.error("Invalid Twilio signature");
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Unauthorized</Message></Response>',
          {
            status: 401,
            headers: { "Content-Type": "text/xml", ...corsHeaders },
          }
        );
      }
    } else {
      console.warn("TWILIO_AUTH_TOKEN not configured - signature validation skipped");
    }
    const from = params["From"] || "";
    const body = params["Body"]?.trim().toUpperCase() || "";
    
    console.log("Received SMS from Twilio", { 
      from, 
      body,
      timestamp: new Date().toISOString() 
    });

    // Validate response
    if (!["SIM", "NAO", "NÃO", "YES", "NO"].includes(body)) {
      console.log("Invalid response received", { body });
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Resposta inválida. Por favor responda SIM ou NÃO.</Message></Response>',
        {
          status: 200,
          headers: { "Content-Type": "text/xml", ...corsHeaders },
        }
      );
    }

    const isConfirmed = ["SIM", "YES"].includes(body);

    // Find pending witness by phone number
    const { data: witnesses, error: fetchError } = await supabaseAdmin
      .from("afroloc_witnesses")
      .select(`
        *,
        afroloc_records!inner(
          code,
          street_name,
          level1_name,
          level2_name,
          level3_name,
          level4_name
        )
      `)
      .eq("status", "pending")
      .not("otp_code", "is", null)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Error fetching witnesses", { error: fetchError });
      throw fetchError;
    }

    // Match phone number (remove country code variations)
    const cleanPhone = from.replace(/\D/g, "");
    const matchedWitness = witnesses?.find(w => {
      const witnessPhone = w.otp_code?.replace(/\D/g, "") || "";
      return cleanPhone.endsWith(witnessPhone) || witnessPhone.endsWith(cleanPhone);
    });

    if (!matchedWitness) {
      console.log("No pending witness found for phone", { 
        from: from.substring(0, 5) + "***",
        timestamp: new Date().toISOString()
      });
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Nenhuma solicitação pendente encontrada.</Message></Response>',
        {
          status: 200,
          headers: { "Content-Type": "text/xml", ...corsHeaders },
        }
      );
    }

    // Check if OTP expired
    const expiresAt = new Date(matchedWitness.otp_expires_at);
    if (expiresAt < new Date()) {
      console.log("OTP expired", { witness_id: matchedWitness.id });
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Prazo de resposta expirado. Solicite um novo código.</Message></Response>',
        {
          status: 200,
          headers: { "Content-Type": "text/xml", ...corsHeaders },
        }
      );
    }

    if (isConfirmed) {
      // Update witness to confirmed
      const { error: updateError } = await supabaseAdmin
        .from("afroloc_witnesses")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          signature: `SMS Confirmation - ${new Date().toISOString()}`,
          otp_code: null,
          otp_expires_at: null,
        })
        .eq("id", matchedWitness.id);

      if (updateError) {
        console.error("Error updating witness", { error: updateError });
        throw updateError;
      }

      console.log("Witness confirmed via SMS", { 
        witness_id: matchedWitness.id,
        timestamp: new Date().toISOString()
      });

      // Notify requester asynchronously
      try {
        await supabaseAdmin.functions.invoke('notify-requester-validation', {
          body: { witness_id: matchedWitness.id }
        });
      } catch (notifyError) {
        console.error("Failed to notify requester", { error: notifyError });
      }

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Obrigado! Confirmação registrada com sucesso.</Message></Response>',
        {
          status: 200,
          headers: { "Content-Type": "text/xml", ...corsHeaders },
        }
      );
    } else {
      // Update witness to rejected
      const { error: updateError } = await supabaseAdmin
        .from("afroloc_witnesses")
        .update({
          status: "rejected",
          rejection_reason: "Testemunha recusou por SMS",
          otp_code: null,
          otp_expires_at: null,
        })
        .eq("id", matchedWitness.id);

      if (updateError) {
        console.error("Error updating witness", { error: updateError });
        throw updateError;
      }

      console.log("Witness rejected via SMS", { 
        witness_id: matchedWitness.id,
        timestamp: new Date().toISOString()
      });

      // Notify requester asynchronously
      try {
        await supabaseAdmin.functions.invoke('notify-requester-validation', {
          body: { witness_id: matchedWitness.id }
        });
      } catch (notifyError) {
        console.error("Failed to notify requester", { error: notifyError });
      }

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Entendido. Sua recusa foi registrada.</Message></Response>',
        {
          status: 200,
          headers: { "Content-Type": "text/xml", ...corsHeaders },
        }
      );
    }
  } catch (error: any) {
    console.error("SMS webhook processing error", { 
      error: error.message,
      timestamp: new Date().toISOString()
    });
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Erro ao processar resposta. Tente novamente.</Message></Response>',
      {
        status: 200,
        headers: { "Content-Type": "text/xml", ...corsHeaders },
      }
    );
  }
};

serve(handler);
