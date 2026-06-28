import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getCurrentUser,
  audit,
  getSupabaseClient,
  errorResponse,
  jsonResponse,
} from "../_shared/auth_rbac.ts";

interface LoginPayload {
  email: string;
  password: string;
}

interface RefreshPayload {
  refresh_token: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || url.pathname.split("/").pop();
    
    console.log(`[auth] Action: ${action}`);

    const supabase = getSupabaseClient();

    switch (action) {
      case "login": {
        if (req.method !== "POST") {
          return errorResponse("POST method required", 405);
        }

        const body: LoginPayload = await req.json();
        
        if (!body.email || !body.password) {
          return errorResponse("Email and password are required", 400);
        }

        // Use Supabase Auth for login
        const { data, error } = await supabase.auth.signInWithPassword({
          email: body.email.toLowerCase(),
          password: body.password,
        });

        if (error) {
          console.error("[auth] Login error:", error.message);
          return errorResponse("Invalid credentials", 401);
        }

        if (!data.user || !data.session) {
          return errorResponse("Invalid credentials", 401);
        }

        // Get user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone, country")
          .eq("user_id", data.user.id)
          .single();

        // Get user roles
        const { data: userRoles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);

        // Log the login
        await audit(supabase, data.user.id, "LOGIN", "auth:login", {
          method: "password",
        }, req);

        return jsonResponse({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          expires_at: data.session.expires_at,
          user: {
            id: data.user.id,
            email: data.user.email,
            full_name: profile?.full_name,
            phone: profile?.phone,
            country: profile?.country,
            roles: userRoles?.map((r) => r.role) || [],
          },
        });
      }

      case "refresh": {
        if (req.method !== "POST") {
          return errorResponse("POST method required", 405);
        }

        const body: RefreshPayload = await req.json();
        
        if (!body.refresh_token) {
          return errorResponse("Refresh token is required", 400);
        }

        // Use Supabase Auth for token refresh
        const { data, error } = await supabase.auth.refreshSession({
          refresh_token: body.refresh_token,
        });

        if (error) {
          console.error("[auth] Refresh error:", error.message);
          return errorResponse("Invalid or expired refresh token", 401);
        }

        if (!data.user || !data.session) {
          return errorResponse("Failed to refresh session", 401);
        }

        // Log the refresh
        await audit(supabase, data.user.id, "REFRESH", "auth:refresh", {}, req);

        return jsonResponse({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          expires_at: data.session.expires_at,
        });
      }

      case "me": {
        // Get current authenticated user
        const currentUser = await getCurrentUser(req);

        return jsonResponse({
          id: currentUser.id,
          email: currentUser.email,
          full_name: currentUser.full_name,
          roles: currentUser.roles,
          authorization_level: currentUser.authorization_level,
          jurisdiction_country: currentUser.jurisdiction_country,
        });
      }

      case "logout": {
        if (req.method !== "POST") {
          return errorResponse("POST method required", 405);
        }

        // Get user before logout for audit
        let userId: string | null = null;
        try {
          const currentUser = await getCurrentUser(req);
          userId = currentUser.id;
        } catch {
          // User might already be logged out
        }

        // Note: Supabase handles token invalidation client-side
        // Server-side we just log the action
        if (userId) {
          await audit(supabase, userId, "LOGOUT", "auth:logout", {}, req);
        }

        return jsonResponse({ success: true, message: "Logged out successfully" });
      }

      case "change-password": {
        if (req.method !== "POST") {
          return errorResponse("POST method required", 405);
        }

        const currentUser = await getCurrentUser(req);
        const body = await req.json();

        if (!body.new_password) {
          return errorResponse("New password is required", 400);
        }

        // Update password using admin API
        const { error } = await supabase.auth.admin.updateUserById(currentUser.id, {
          password: body.new_password,
        });

        if (error) {
          console.error("[auth] Change password error:", error.message);
          return errorResponse("Failed to change password", 400);
        }

        await audit(supabase, currentUser.id, "PASSWORD_CHANGE", "auth:change-password", {}, req);

        return jsonResponse({ success: true, message: "Password changed successfully" });
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error("[auth] Error:", error);
    
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes("Missing Bearer") || message.includes("Invalid or expired")) {
      return errorResponse(message, 401);
    }
    
    return errorResponse(message, 400);
  }
});
