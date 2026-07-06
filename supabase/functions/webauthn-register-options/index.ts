import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { generateRegistrationOptions } from "https://esm.sh/@simplewebauthn/server@9.0.3";
import { corsHeaders } from "../_shared/auth_rbac.ts";
import { fromBase64Url, resolveOrigin } from "../_shared/webauthn.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Utilizador autenticado (o passkey é registado à conta com sessão ativa).
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
    if (!oc) return json(403, { error: "Origem não permitida (verifique WEBAUTHN_ALLOWED_ORIGINS)" });

    const body = await req.json().catch(() => ({}));
    const phone = user.phone || body?.phone_number || null;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Excluir passkeys já registados neste utilizador (evita duplicados).
    const { data: existing } = await admin
      .from("webauthn_credentials")
      .select("credential_id, transports")
      .eq("user_id", user.id);

    const options = await generateRegistrationOptions({
      rpName: "AFROLOC",
      rpID: oc.rpID,
      userID: user.id,
      userName: phone || user.email || user.id,
      userDisplayName: phone || "AFROLOC",
      timeout: 60000,
      attestationType: "none",
      excludeCredentials: (existing ?? []).map((c) => ({
        id: fromBase64Url(c.credential_id),
        type: "public-key" as const,
        transports: (c.transports ?? undefined) as AuthenticatorTransport[] | undefined,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
        authenticatorAttachment: "platform", // Face ID / Touch ID / impressão do dispositivo
      },
    });

    // Guardar o challenge (efémero) para verificar no verify. Um por utilizador/tipo.
    await admin.from("webauthn_challenges").delete()
      .eq("user_id", user.id).eq("type", "register");
    const { error: chErr } = await admin.from("webauthn_challenges").insert({
      user_id: user.id,
      phone_number: phone,
      challenge: options.challenge,
      type: "register",
    });
    if (chErr) return json(500, { error: chErr.message });

    return json(200, options);
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
