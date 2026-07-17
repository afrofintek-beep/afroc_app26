/**
 * IMBAMBA — Rede: CHEGADA AO PONTO + notificação real do destinatário (Fase 3).
 * Copyright © 2026 AFROFINTEK GmbH.
 *
 * 1) Avança a encomenda para 'arrived' COMO O UTILIZADOR (net_parcel_advance
 *    valida net_is_manager e gera o OTP de recolha).
 * 2) Notifica o destinatário com o OTP: e-mail (Resend) se o contacto for e-mail,
 *    ou SMS (Infobip) se for telefone. Best-effort — a chegada persiste mesmo que
 *    o envio falhe; devolve o OTP para o gestor comunicar manualmente se preciso.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/auth_rbac.ts";
import { sendSms } from "../_shared/sms.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Cliente no contexto DO UTILIZADOR (para a RPC validar o papel via auth.uid()).
    const asUser = createClient(URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(URL, SERVICE);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return json({ error: "Invalid or expired token" }, 401);

    const body = await req.json().catch(() => ({}));
    const parcelId = body.parcel_id as string;
    if (!parcelId) return json({ error: "parcel_id em falta." }, 400);

    // 1) Avançar para 'arrived' (gera OTP) — permissões impostas pela RPC.
    const { data: adv, error: advErr } = await asUser.rpc("net_parcel_advance", {
      p_id: parcelId, p_to: "arrived", p_note: null,
    });
    if (advErr) return json({ error: advErr.message }, 403);
    const otp = (adv as { otp?: string })?.otp ?? null;

    // 2) Carregar dados do destinatário + ponto (service role).
    const { data: parcel } = await admin.from("net_parcels")
      .select("recipient_name, recipient_contact, tracking_code, point_id").eq("id", parcelId).single();
    let pointName = "";
    if (parcel?.point_id) {
      const { data: pt } = await admin.from("net_points").select("name").eq("id", parcel.point_id).maybeSingle();
      pointName = pt?.name ?? "";
    }

    const contact = (parcel?.recipient_contact ?? "").trim();
    const where = pointName ? `ao Ponto Imbamba ${pointName}` : "ao ponto de recolha";
    const text = `Olá ${parcel?.recipient_name ?? ""}, a sua encomenda ${parcel?.tracking_code ?? ""} chegou ${where}. `
      + `Código de recolha: ${otp}. Apresente-o no levantamento. — Imbamba · Correios de Angola`;

    let channel: "email" | "sms" | "none" = "none";
    let sent = false;
    let sendError: string | null = null;

    if (contact.includes("@")) {
      channel = "email";
      try {
        const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
        const from = Deno.env.get("IMBAMBA_MAIL_FROM") ?? Deno.env.get("MAIL_FROM") ?? "Imbamba <onboarding@resend.dev>";
        const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto">
          <div style="background:#F7C325;padding:16px;border-radius:12px 12px 0 0;text-align:center">
            <strong style="font-size:18px;color:#111">Imbamba</strong>
            <div style="font-size:12px;color:#CC2229;font-weight:600">AFROLOC × Correios de Angola</div>
          </div>
          <div style="border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px;padding:20px">
            <p>Olá <strong>${parcel?.recipient_name ?? ""}</strong>,</p>
            <p>A sua encomenda <strong>${parcel?.tracking_code ?? ""}</strong> chegou ${where}.</p>
            <p style="text-align:center;margin:20px 0">
              <span style="display:inline-block;background:#fff7e6;border:1px solid #F7C325;border-radius:10px;padding:12px 22px;font-size:30px;font-weight:700;letter-spacing:6px;color:#8a6d1a">${otp}</span>
            </p>
            <p style="color:#555">Apresente este código de recolha no levantamento da encomenda.</p>
          </div></div>`;
        const r = await resend.emails.send({
          from, to: contact,
          subject: `Encomenda ${parcel?.tracking_code ?? ""} — código de recolha`,
          html,
        });
        if (r.error) sendError = r.error.message; else sent = true;
      } catch (e) { sendError = e instanceof Error ? e.message : String(e); }
    } else if (/^[+0-9][0-9\s]{6,}$/.test(contact)) {
      channel = "sms";
      try {
        const r = await sendSms(contact.replace(/\s+/g, ""), text);
        sent = r.ok; if (!r.ok) sendError = r.error ?? "SMS não entregue";
      } catch (e) { sendError = e instanceof Error ? e.message : String(e); }
    } else {
      sendError = "Sem contacto válido (e-mail ou telefone) para notificar.";
    }

    // Registar o resultado na timeline (service role — eventos são só via service).
    await admin.from("net_parcel_events").insert({
      parcel_id: parcelId,
      status: "arrived",
      note: sent ? `Destinatário notificado por ${channel}` : `Notificação falhou (${channel}): ${sendError}`,
    });

    return json({ ok: true, otp, channel, sent, sendError });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500);
  }
});
