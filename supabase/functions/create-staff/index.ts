import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";

/**
 * CREATE STAFF — provisionamento de funcionários pelo admin.
 * Cria a conta (convite por email para definir palavra-passe), aprova o perfil,
 * atribui o papel de staff e (para validadores) a jurisdição. Tudo auditado.
 * O funcionário NÃO passa pelo onboarding de cidadão.
 */
const ADMIN_ROLES = ["admin", "admin_national", "admin_province", "admin_municipality"];
const STAFF_ROLES = ["operator_field", "moderator", "authority", "auditor_read"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, service);

    // 1) Autenticar o chamador e exigir papel de admin.
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return json({ error: "unauthorized" }, 401);
    const { data: { user: caller }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !caller) return json({ error: "invalid token" }, 401);

    const { data: callerRoles } = await sb.from("user_roles").select("role").eq("user_id", caller.id);
    if (!(callerRoles ?? []).some((r: { role: string }) => ADMIN_ROLES.includes(r.role))) {
      return json({ error: "forbidden: admin role required" }, 403);
    }

    // 2) Validar entrada.
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const fullName = String(body.fullName ?? "").trim() || null;
    const role = String(body.role ?? "");
    const jurisdiction = body.jurisdiction ?? null;
    const redirectTo = String(body.redirectTo ?? `${url.replace(".supabase.co", "")}`) || undefined;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "email inválido" }, 400);
    if (!STAFF_ROLES.includes(role)) return json({ error: "papel inválido" }, 400);

    // 3) Já existe? Se não, convidar (cria a conta + email para definir palavra-passe).
    let userId: string | null = null;
    let invited = false;
    const { data: existingId } = await sb.rpc("get_user_id_by_email", { p_email: email });
    if (existingId) {
      userId = existingId as string;
    } else {
      const { data: inv, error: invErr } = await sb.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo,
      });
      if (invErr || !inv?.user) {
        // corrida: talvez tenha passado a existir entretanto
        const { data: retryId } = await sb.rpc("get_user_id_by_email", { p_email: email });
        if (!retryId) return json({ error: invErr?.message ?? "falha ao criar conta" }, 400);
        userId = retryId as string;
      } else {
        userId = inv.user.id;
        invited = true;
      }
    }

    // 4) Perfil aprovado + nome (o convite já disparou o trigger que cria o perfil).
    await sb.from("profiles").update({
      approval_status: "approved",
      onboarding_completed: true,
      ...(fullName ? { full_name: fullName } : {}),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);

    // 5) Papel de staff.
    const { data: hasRole } = await sb.from("user_roles").select("id").eq("user_id", userId).eq("role", role).maybeSingle();
    if (!hasRole) await sb.from("user_roles").insert({ user_id: userId, role });

    // 6) Jurisdição (só validadores de endereços).
    if (role === "operator_field" && jurisdiction) {
      await sb.from("user_authorization_levels").upsert({
        user_id: userId,
        administrative_role: "operator_field",
        jurisdiction_country: jurisdiction.country ?? "AO",
        jurisdiction_level1_code: jurisdiction.l1_code ?? null,
        jurisdiction_level1_name: jurisdiction.l1_name ?? null,
        jurisdiction_level2_code: jurisdiction.l2_code ?? null,
        jurisdiction_level2_name: jurisdiction.l2_name ?? null,
        assigned_by_user_id: caller.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }

    // 7) Auditoria.
    await sb.from("security_audit_log").insert({
      action: "create_staff",
      function_name: "create-staff",
      user_id: userId,
      details: {
        email, role, invited,
        full_name: fullName,
        jurisdiction: jurisdiction ? (jurisdiction.l2_name ?? jurisdiction.l1_name ?? jurisdiction.country) : null,
        by: caller.id,
        at: new Date().toISOString(),
      },
    });

    return json({ ok: true, invited, userId, email });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});
