import { corsHeaders, getAuthUser, getCurrentUser, hasAnyRole, isAdmin, errorResponse, jsonResponse, audit } from "../_shared/auth_rbac.ts";

/**
 * Manage Yamioo Agents
 * 
 * GET  → list all agents (with profile info)
 * POST { user_id, notes? } → register a new agent
 * DELETE { agent_id } → deactivate an agent
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const currentUser = await getCurrentUser(req);

    if (!isAdmin(currentUser)) {
      return errorResponse(new Error("Forbidden: requires admin role"), 403);
    }

    const { supabase } = await getAuthUser(req);

    // ─── LIST AGENTS ───
    if (req.method === "GET") {
      const { data: agents, error } = await supabase
        .from("yamioo_agents")
        .select("*")
        .order("agent_number", { ascending: true });

      if (error) {
        console.error("List agents error:", error);
        return errorResponse(new Error("Failed to list agents"), 500);
      }

      // Enrich with profile data
      const enriched = await Promise.all(
        (agents || []).map(async (a: any) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, phone, country, city")
            .eq("user_id", a.user_id)
            .single();

          const { data: authUser } = await supabase.auth.admin.getUserById(a.user_id);

          return {
            ...a,
            full_name: profile?.full_name || null,
            phone: profile?.phone || null,
            email: authUser?.user?.email || null,
            country: profile?.country || null,
            city: profile?.city || null,
          };
        })
      );

      return jsonResponse({ agents: enriched });
    }

    // ─── REGISTER AGENT ───
    if (req.method === "POST") {
      const { user_id, notes } = await req.json();

      if (!user_id || typeof user_id !== "string") {
        return errorResponse(new Error("user_id is required"), 400);
      }

      // Check if already an agent
      const { data: existing } = await supabase
        .from("yamioo_agents")
        .select("id, is_active")
        .eq("user_id", user_id)
        .maybeSingle();

      if (existing?.is_active) {
        return errorResponse(new Error("User is already an active Yamioo agent"), 409);
      }

      // If inactive, reactivate
      if (existing && !existing.is_active) {
        const { error: reactivateError } = await supabase
          .from("yamioo_agents")
          .update({ is_active: true, notes: notes || existing.notes })
          .eq("id", existing.id);

        if (reactivateError) {
          console.error("Reactivate error:", reactivateError);
          return errorResponse(new Error("Failed to reactivate agent"), 500);
        }

        // Ensure role exists
        await supabase.from("user_roles").upsert(
          { user_id, role: "yamioo_agent" },
          { onConflict: "user_id,role" }
        );

        await audit(supabase, currentUser.id, "yamioo_agent_reactivated", "manage-yamioo-agents", { target_user_id: user_id }, req);

        return jsonResponse({ success: true, reactivated: true });
      }

      // Register new agent using the database function
      const { data: result, error: registerError } = await supabase.rpc("register_yamioo_agent", {
        p_user_id: user_id,
        p_registered_by: currentUser.id,
        p_notes: notes || null,
      });

      if (registerError) {
        console.error("Register agent error:", registerError);
        return errorResponse(new Error(registerError.message || "Failed to register agent"), 500);
      }

      await audit(supabase, currentUser.id, "yamioo_agent_registered", "manage-yamioo-agents", { target_user_id: user_id }, req);

      return jsonResponse({ success: true, agent_number: result });
    }

    // ─── DEACTIVATE AGENT ───
    if (req.method === "DELETE") {
      const { agent_id } = await req.json();

      if (!agent_id) {
        return errorResponse(new Error("agent_id is required"), 400);
      }

      // Get agent info for audit
      const { data: agent } = await supabase
        .from("yamioo_agents")
        .select("user_id")
        .eq("id", agent_id)
        .single();

      if (!agent) {
        return errorResponse(new Error("Agent not found"), 404);
      }

      const { error: deactivateError } = await supabase
        .from("yamioo_agents")
        .update({ is_active: false })
        .eq("id", agent_id);

      if (deactivateError) {
        console.error("Deactivate error:", deactivateError);
        return errorResponse(new Error("Failed to deactivate agent"), 500);
      }

      // Remove role
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", agent.user_id)
        .eq("role", "yamioo_agent");

      await audit(supabase, currentUser.id, "yamioo_agent_deactivated", "manage-yamioo-agents", { target_user_id: agent.user_id, agent_id }, req);

      return jsonResponse({ success: true });
    }

    return errorResponse(new Error("Method not allowed"), 405);
  } catch (err) {
    return errorResponse(err);
  }
});
