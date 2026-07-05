// AFROLOC — envio de SMS via Infobip (substitui o Twilio).
//
// Camada única e roteável (visão panafricana): hoje tudo via Infobip; para
// acrescentar um gateway local/africano por país, edita `providerFor` e a
// respetiva função de envio — as edge functions chamam só `sendSms`.
//
// Secrets necessários (Supabase → Edge Functions → Secrets):
//   INFOBIP_BASE_URL   ex.: https://grkyl8.api.infobip.com
//   INFOBIP_API_KEY
//   INFOBIP_SENDER     ex.: AFROLOC   (opcional; default "AFROLOC")

export interface SmsResult {
  ok: boolean;
  status?: number;
  messageId?: string;
  error?: string;
  /** Diagnóstico do fornecedor: status da mensagem devolvido no envio. */
  providerStatus?: { groupName?: string; name?: string; description?: string };
}

type Provider = "infobip"; // futuros: "termii" | "clickatell" | "africastalking"

/** Roteamento por código de país (E.164). Hoje tudo → Infobip. */
function providerFor(_e164: string): Provider {
  // ex.: if (_e164.startsWith("+234")) return "termii"; // Nigéria 🇳🇬
  return "infobip";
}

async function sendViaInfobip(toE164: string, text: string): Promise<SmsResult> {
  const baseUrl = Deno.env.get("INFOBIP_BASE_URL");
  const apiKey = Deno.env.get("INFOBIP_API_KEY");
  const sender = Deno.env.get("INFOBIP_SENDER") || "AFROLOC";

  if (!baseUrl || !apiKey) {
    return { ok: false, error: "INFOBIP_BASE_URL / INFOBIP_API_KEY não configurados" };
  }

  const to = toE164.replace(/^\+/, ""); // Infobip aceita sem o "+"
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/sms/2/text/advanced`, {
      method: "POST",
      headers: {
        Authorization: `App ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        messages: [{ destinations: [{ to }], from: sender, text }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, status: res.status, error: `Infobip ${res.status}: ${body}` };
    }
    const data = await res.json().catch(() => ({}));
    const msg = data?.messages?.[0];
    const st = msg?.status;
    // Log do status para diagnóstico (visível nos logs da função).
    console.log("[infobip] enviado:", JSON.stringify({ to, from: sender, messageId: msg?.messageId, status: st }));
    return {
      ok: true,
      messageId: msg?.messageId,
      providerStatus: st ? { groupName: st.groupName, name: st.name, description: st.description } : undefined,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Envia um SMS para um número E.164. Decide o fornecedor por país. */
export async function sendSms(to: string, text: string): Promise<SmsResult> {
  const e164 = to.startsWith("+") ? to : `+${to}`;
  switch (providerFor(e164)) {
    case "infobip":
      return await sendViaInfobip(e164, text);
  }
}
