import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { verifyRegistrationResponse } from "https://esm.sh/@simplewebauthn/server@9.0.3";
import { corsHeaders } from "../_shared/auth_rbac.ts";
import { resolveOrigin, toBase64Url } from "../_shared/webauthn.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      },
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json(401, { error: "Unauthorized" });

    const oc = resolveOrigin(req);
    if (!oc) return json(403, { error: "Origem não permitida" });

    const { credential, device_name } = await req.json();
    if (!credential) return json(400, { error: "Credential em falta" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Challenge guardado no passo de opções.
    const { data: ch } = await admin
      .from("webauthn_challenges")
      .select("*")
      .eq("user_id", user.id)
      .eq("type", "register")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ch) return json(400, { error: "Desafio não encontrado ou expirado. Tente de novo." });

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: ch.challenge,
        expectedOrigin: oc.origin,
        expectedRPID: oc.rpID,
        requireUserVerification: true,
      });
    } catch (e) {
      return json(400, { error: "Verificação falhou: " + (e instanceof Error ? e.message : String(e)) });
    }

    if (!verification.verified || !verification.registrationInfo) {
      return json(400, { error: "Passkey não verificado" });
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

    const { error: insErr } = await admin.from("webauthn_credentials").insert({
      user_id: user.id,
      phone_number: ch.phone_number || user.phone || null,
      credential_id: toBase64Url(credentialID),
      public_key: toBase64Url(credentialPublicKey),
      counter: counter ?? 0,
      transports: credential?.response?.transports ?? null,
      device_name: device_name ?? null,
    });
    if (insErr) {
      if ((insErr.message || "").toLowerCase().includes("duplicate")) {
        return json(409, { error: "Este passkey já está registado nesta conta." });
      }
      return json(500, { error: insErr.message });
    }

    // Limpar o challenge usado.
    await admin.from("webauthn_challenges").delete().eq("id", ch.id);

    return json(200, { success: true });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
