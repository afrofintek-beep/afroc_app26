// AFROLOC / IMBAMBA — envio de OTP por WhatsApp via Meta Cloud API.
//
// Mensagens iniciadas pela empresa (como um OTP) EXIGEM um template aprovado
// (categoria "Authentication"). Configura por segredos:
//   WHATSAPP_TOKEN            token permanente da app Meta (System User)
//   WHATSAPP_PHONE_ID         phone_number_id do número WhatsApp Business
//   WHATSAPP_TEMPLATE         nome do template aprovado (ex.: "imbamba_otp")
//   WHATSAPP_LANG             código de língua do template (default "pt_PT")
//   WHATSAPP_TEMPLATE_BUTTON  "false" para templates sem botão copiar-código
//
// Melhor custo/fiabilidade que SMS puro em Angola (Unitel/Africell) — ver
// discussão do canal OTP. Reutilizável por qualquer função (recolha, login…).

export interface WaResult { ok: boolean; error?: string; id?: string }

/** Normaliza para internacional sem "+": Angola móvel local (9 díg. a começar em 9) → 244…. */
export function toIntl(raw: string): string {
  let d = (raw || "").replace(/[^\d]/g, "");
  if (d.length === 9 && d.startsWith("9")) d = "244" + d;
  return d;
}

export async function sendWhatsAppOtp(to: string, otp: string): Promise<WaResult> {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_ID");
  const template = Deno.env.get("WHATSAPP_TEMPLATE");
  const lang = Deno.env.get("WHATSAPP_LANG") ?? "pt_PT";
  if (!token || !phoneId || !template) {
    return { ok: false, error: "WhatsApp não configurado (WHATSAPP_TOKEN/PHONE_ID/TEMPLATE)." };
  }

  const num = toIntl(to);
  const hasButton = (Deno.env.get("WHATSAPP_TEMPLATE_BUTTON") ?? "true") !== "false";

  // Template de autenticação: o código vai no corpo e (opcional) no botão de
  // copiar-código/autofill. Ajusta WHATSAPP_TEMPLATE_BUTTON conforme o template.
  const components: unknown[] = [
    { type: "body", parameters: [{ type: "text", text: otp }] },
  ];
  if (hasButton) {
    components.push({ type: "button", sub_type: "url", index: 0, parameters: [{ type: "text", text: otp }] });
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: num,
        type: "template",
        template: { name: template, language: { code: lang }, components },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: body?.error?.message ?? `WhatsApp HTTP ${res.status}` };
    }
    return { ok: true, id: body?.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
