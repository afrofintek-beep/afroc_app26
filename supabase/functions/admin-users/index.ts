import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  getCurrentUser,
  requireRoles,
  isAdmin,
  audit,
  getSupabaseClient,
  errorResponse,
  jsonResponse,
} from "../_shared/auth_rbac.ts";

interface UserPayload {
  email?: string;
  full_name?: string;
  password?: string;
  role?: string;
  roles?: string[];  // Support multiple roles like Python version
  scope_type?: string;
  scope_value?: string;
  is_active?: boolean;
}

// Helper to check if user has specific role
function hasRole(user: { roles: string[] }, ...allowedRoles: string[]): boolean {
  return user.roles.some((role) => allowedRoles.includes(role));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authenticated user using shared auth module
    const currentUser = await getCurrentUser(req);
    
    // Require admin role using shared helper
    requireRoles(currentUser, "admin", "admin_national", "admin_province", "admin_municipality");

    const supabase = getSupabaseClient();
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const targetUserId = url.searchParams.get("userId");

    console.log(`[admin-users] Action: ${action}, User: ${currentUser.email}, Target: ${targetUserId}`);

    switch (action) {
      case "list": {
        // List all users with roles and scopes
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Get roles for each user
        const userIds = profiles?.map((p) => p.user_id) || [];
        const { data: userRoles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);

        const { data: authLevels } = await supabase
          .from("user_authorization_levels")
          .select("*")
          .in("user_id", userIds);

        // Merge data
        const usersWithRoles = profiles?.map((profile) => ({
          ...profile,
          roles: userRoles?.filter((r) => r.user_id === profile.user_id).map((r) => r.role) || [],
          authorization: authLevels?.find((a) => a.user_id === profile.user_id) || null,
        }));

        await audit(supabase, currentUser.id, "USER_LIST", "admin-users:list", {}, req);

        return jsonResponse({ users: usersWithRoles });
      }

      case "create": {
        // Only admin_national can create users (matching Python requirement)
        if (!hasRole(currentUser, "admin", "admin_national")) {
          return errorResponse("Forbidden: Only admin_national can create users", 403);
        }

        const body: UserPayload = await req.json();
        
        if (!body.email || !body.password || !body.full_name) {
          throw new Error("Email, password, and full_name are required");
        }

        const email = body.email.toLowerCase();

        // Check if email already exists
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const emailExists = existingUsers?.users?.some(
          (u) => u.email?.toLowerCase() === email
        );

        if (emailExists) {
          return errorResponse("Email already exists", 409);
        }

        // Create user in auth
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: email,
          password: body.password,
          email_confirm: true,
          user_metadata: { full_name: body.full_name },
        });

        if (createError) throw createError;

        // Create profile
        await supabase.from("profiles").insert({
          user_id: newUser.user.id,
          full_name: body.full_name,
          onboarding_completed: true,
        });

        // Assign roles (support both single role and array of roles)
        const rolesToAssign = body.roles || (body.role ? [body.role] : ["citizen"]);
        
        for (const role of rolesToAssign) {
          await supabase.from("user_roles").insert({
            user_id: newUser.user.id,
            role: role,
          });
        }

        // Determine authorization level based on highest role
        const highestRole = rolesToAssign.includes("admin_national") ? "admin_national" :
                          rolesToAssign.includes("admin_province") ? "admin_province" :
                          rolesToAssign.includes("admin_municipality") ? "admin_municipality" : null;

        // Assign scope if provided or if admin role
        if (highestRole || (body.scope_type && body.scope_value)) {
          await supabase.from("user_authorization_levels").insert({
            user_id: newUser.user.id,
            jurisdiction_country: body.scope_type === "country" ? body.scope_value : "AO",
            jurisdiction_level1_code: body.scope_type === "province" ? body.scope_value : null,
            jurisdiction_level2_code: body.scope_type === "municipality" ? body.scope_value : null,
            current_level: highestRole === "admin_national" ? 5 : 
                          highestRole === "admin_province" ? 4 : 
                          highestRole === "admin_municipality" ? 3 : 1,
          });
        }

        // Get final roles for response
        const { data: userRoles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", newUser.user.id);

        const finalRoles = userRoles?.map((r) => r.role) || [];

        await audit(supabase, currentUser.id, "USER_CREATE", "admin-users:create", {
          created_user_id: newUser.user.id,
          email: email,
          roles: finalRoles,
        }, req);

        return jsonResponse({
          id: newUser.user.id,
          email: newUser.user.email,
          full_name: body.full_name,
          is_active: true,
          roles: finalRoles,
        });
      }

      case "update": {
        if (!targetUserId) throw new Error("userId is required");
        
        const body: UserPayload = await req.json();
        const updates: Record<string, unknown> = {};

        if (body.full_name) updates.full_name = body.full_name;
        if (typeof body.is_active === "boolean") updates.is_active = body.is_active;

        // Update password if provided (admin reset)
        if (body.password) {
          const { error: pwError } = await supabase.auth.admin.updateUserById(
            targetUserId,
            { password: body.password }
          );
          if (pwError) throw pwError;
          console.log(`[admin-users] Password reset for user ${targetUserId}`);
        }

        // Update profile
        if (Object.keys(updates).length > 0) {
          const { error } = await supabase
            .from("profiles")
            .update(updates)
            .eq("user_id", targetUserId);
          if (error) throw error;
        }

        // Update role if provided
        if (body.role) {
          // Remove existing roles and add new one
          await supabase.from("user_roles").delete().eq("user_id", targetUserId);
          await supabase.from("user_roles").insert({
            user_id: targetUserId,
            role: body.role,
          });
        }

        // Update scope if provided
        if (body.scope_type && body.scope_value) {
          await supabase
            .from("user_authorization_levels")
            .upsert({
              user_id: targetUserId,
              jurisdiction_country: body.scope_type === "country" ? body.scope_value : null,
              jurisdiction_level1_code: body.scope_type === "province" ? body.scope_value : null,
              jurisdiction_level2_code: body.scope_type === "municipality" ? body.scope_value : null,
              current_level: body.role === "admin_national" ? 5 : 
                            body.role === "admin_province" ? 4 : 
                            body.role === "admin_municipality" ? 3 : 1,
            }, { onConflict: "user_id" });
        }

        await audit(supabase, currentUser.id, "USER_UPDATE", "admin-users:update", {
          target_user_id: targetUserId,
          updates: body,
        }, req);

        return jsonResponse({ success: true });
      }

      case "delete": {
        if (!targetUserId) throw new Error("userId is required");
        
        // Prevent self-deletion
        if (targetUserId === currentUser.id) {
          throw new Error("Cannot delete your own account");
        }

        await audit(supabase, currentUser.id, "USER_DELETE", "admin-users:delete", {
          deleted_user_id: targetUserId,
        }, req);

        // Delete user from auth (cascades to profile via FK)
        const { error } = await supabase.auth.admin.deleteUser(targetUserId);
        if (error) throw error;

        return jsonResponse({ success: true });
      }

      case "get-roles": {
        const { data: roles, error } = await supabase
          .from("roles")
          .select("*")
          .order("id");

        if (error) throw error;

        return jsonResponse({ roles });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("[admin-users] Error:", error);
    
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes("Missing Bearer") || message.includes("Invalid or expired")) {
      return errorResponse(message, 401);
    }
    
    if (message.includes("Forbidden") || message.includes("Requires")) {
      return errorResponse(message, 403);
    }
    
    return errorResponse(message, 400);
  }
});
