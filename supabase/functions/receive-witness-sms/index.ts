import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";
import { sendSms } from "../_shared/sms.ts";

// Webhook INBOUND (MO) da Infobip — substitui o webhook Twilio.
// A Infobip entrega as mensagens recebidas como JSON: { results: [{ from, text, ... }] }
// e NÃO suporta resposta via TwiML; a resposta à testemunha é enviada por uma
// chamada de saída separada (sendSms). Requer um NÚMERO INBOUND dedicado na
// Infobip, configurado no portal a reencaminhar para esta função.

// Autenticação opcional do webhook via Basic Auth (configura o mesmo user/pass
// no forwarding do portal Infobip). Sem secrets definidos, não bloqueia
// (paridade com o comportamento anterior quando o token não estava configurado).
const isAuthorized = (req: Request): boolean => {
  const user = Deno.env.get("INFOBIP_INBOUND_USER");
  const pass = Deno.env.get("INFOBIP_INBOUND_PASS");
  if (!user || !pass) {
    console.warn("INFOBIP_INBOUND_USER/PASS não configurados — auth do webhook ignorada");
    return true;
  }
  return (req.headers.get("authorization") || "") === "Basic " + btoa(`${user}:${pass}`);
};

// Extrai a primeira mensagem { from, text } do payload inbound da Infobip.
const parseInbound = async (req: Request): Promise<{ from: string; text: string }> => {
  const payload = await req.json().catch(() => ({} as Record<string, unknown>));
  const msg = (payload as { results?: Array<{ from?: string; text?: string }> })?.results?.[0] ?? {};
  return { from: msg.from ?? "", text: (msg.text ?? "").toString() };
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // A Infobip só precisa de um 200. A resposta à testemunha vai por sendSms.
  const ok = () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  const reply = async (to: string, text: string) => {
    if (to) {
      try {
        await sendSms(to, text);
      } catch (e) {
        console.error("Falha ao responder por SMS (Infobip)", {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return ok();
  };

  try {
    if (!isAuthorized(req)) {
      console.error("Webhook inbound não autorizado");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { from, text } = await parseInbound(req);
    const body = text.trim().toUpperCase();

    console.log("SMS inbound recebido (Infobip)", {
      from: from.substring(0, 5) + "***",
      body,
      timestamp: new Date().toISOString(),
    });

    // Validate response
    if (!["SIM", "NAO", "NÃO", "YES", "NO"].includes(body)) {
      console.log("Resposta inválida recebida", { body });
      return await reply(from, "Resposta inválida. Por favor responda SIM ou NÃO.");
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
        timestamp: new Date().toISOString(),
      });
      return await reply(from, "Nenhuma solicitação pendente encontrada.");
    }

    // Check if OTP expired
    const expiresAt = new Date(matchedWitness.otp_expires_at);
    if (expiresAt < new Date()) {
      console.log("OTP expired", { witness_id: matchedWitness.id });
      return await reply(from, "Prazo de resposta expirado. Solicite um novo código.");
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
        timestamp: new Date().toISOString(),
      });

      // Notify requester asynchronously
      try {
        await supabaseAdmin.functions.invoke('notify-requester-validation', {
          body: { witness_id: matchedWitness.id }
        });
      } catch (notifyError) {
        console.error("Failed to notify requester", { error: notifyError });
      }

      return await reply(from, "Obrigado! Confirmação registrada com sucesso.");
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
        timestamp: new Date().toISOString(),
      });

      // Notify requester asynchronously
      try {
        await supabaseAdmin.functions.invoke('notify-requester-validation', {
          body: { witness_id: matchedWitness.id }
        });
      } catch (notifyError) {
        console.error("Failed to notify requester", { error: notifyError });
      }

      return await reply(from, "Entendido. Sua recusa foi registrada.");
    }
  } catch (error: any) {
    console.error("SMS webhook processing error", {
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    // Devolve 200 para a Infobip não reentregar em loop; sem resposta fiável aqui.
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
