/**
 * IMBAMBA — Rede: gestão da EQUIPA & PAPÉIS (Fase 3).
 * Copyright © 2026 AFROFINTEK GmbH.
 *
 * Ações (body.action): list | add | remove.
 * Só GESTORES GLOBAIS (net_managers com operator_id NULL) podem gerir a equipa.
 * Resolve e-mail → utilizador via admin API (o cliente não tem acesso a auth.users).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return json({ error: "Invalid or expired token" }, 401);

    // O chamador tem de ser gestor GLOBAL (operator_id NULL).
    const { data: me } = await admin
      .from("net_managers").select("role, operator_id").eq("user_id", user.id).maybeSingle();
    if (!me) return json({ error: "Não és gestor da rede." }, 403);
    const isGlobal = me.operator_id === null;
    if (!isGlobal) return json({ error: "Só gestores globais gerem a equipa." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // Utilitário: mapa user_id → email (admin API, paginado).
    const emailMap = async (): Promise<Record<string, string>> => {
      const map: Record<string, string> = {};
      let page = 1;
      for (;;) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) break;
        for (const u of data.users) map[u.id] = u.email ?? "";
        if (data.users.length < 200) break;
        page += 1;
        if (page > 25) break; // salvaguarda
      }
      return map;
    };

    if (action === "list") {
      const { data: rows, error } = await admin
        .from("net_managers").select("user_id, role, operator_id, added_by, created_at")
        .order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 400);
      const emails = await emailMap();
      const members = (rows ?? []).map((r) => ({ ...r, email: emails[r.user_id] || "(desconhecido)" }));
      return json({ members });
    }

    if (action === "add") {
      const email = (body.email as string || "").trim().toLowerCase();
      const role = (body.role as string) || "manager";
      const operatorId = (body.operator_id as string) || null;
      if (!email) return json({ error: "E-mail em falta." }, 400);
      if (!["manager", "operator_admin"].includes(role)) return json({ error: "Papel inválido." }, 400);
      if (role === "operator_admin" && !operatorId) return json({ error: "operator_admin exige um operador." }, 400);

      // Resolver e-mail → utilizador (tem de já ter conta).
      const emails = await emailMap();
      const uid = Object.keys(emails).find((id) => emails[id].toLowerCase() === email);
      if (!uid) return json({ error: "Sem conta com esse e-mail. O utilizador tem de criar conta primeiro." }, 404);

      const { error } = await admin.from("net_managers").upsert({
        user_id: uid,
        role,
        operator_id: role === "manager" ? null : operatorId,
        added_by: user.id,
      }, { onConflict: "user_id" });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, user_id: uid });
    }

    if (action === "remove") {
      const target = body.user_id as string;
      if (!target) return json({ error: "user_id em falta." }, 400);
      if (target === user.id) return json({ error: "Não te podes remover a ti próprio." }, 400);

      // Não deixar a rede sem nenhum gestor global.
      const { data: globals } = await admin
        .from("net_managers").select("user_id").is("operator_id", null);
      const globalIds = (globals ?? []).map((g) => g.user_id);
      if (globalIds.length <= 1 && globalIds.includes(target)) {
        return json({ error: "É o único gestor global — não pode ser removido." }, 400);
      }

      const { error } = await admin.from("net_managers").delete().eq("user_id", target);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500);
  }
});
