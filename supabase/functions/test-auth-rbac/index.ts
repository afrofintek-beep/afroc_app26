import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  getCurrentUser,
  requireRoles,
  isAdmin,
  isAuditor,
  isOperator,
  hasAnyRole,
  audit,
  getSupabaseClient,
  errorResponse,
  jsonResponse,
} from "../_shared/auth_rbac.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "info";

    console.log(`[test-auth-rbac] Action: ${action}`);

    // Get authenticated user
    const user = await getCurrentUser(req);
    console.log(`[test-auth-rbac] User: ${user.email}, Roles: ${user.roles.join(", ")}`);

    const supabase = getSupabaseClient();

    // Log this test action
    await audit(supabase, user.id, "test_auth_rbac", `action:${action}`, { action }, req);

    switch (action) {
      case "info":
        // Return user info (no role requirement)
        return jsonResponse({
          success: true,
          message: "User info retrieved successfully",
          user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            roles: user.roles,
            authorization_level: user.authorization_level,
            jurisdiction_country: user.jurisdiction_country,
          },
          checks: {
            isAdmin: isAdmin(user),
            isAuditor: isAuditor(user),
            isOperator: isOperator(user),
            hasAdminRole: hasAnyRole(user, "admin"),
            hasModeratorRole: hasAnyRole(user, "moderator"),
            hasCitizenRole: hasAnyRole(user, "citizen"),
          },
        });

      case "admin-only":
        // Test admin-only access
        requireRoles(user, "admin", "admin_national", "admin_province", "admin_municipality");
        return jsonResponse({
          success: true,
          message: "Admin access verified!",
          user: { id: user.id, email: user.email, roles: user.roles },
        });

      case "moderator-only":
        // Test moderator-only access
        requireRoles(user, "moderator", "admin");
        return jsonResponse({
          success: true,
          message: "Moderator access verified!",
          user: { id: user.id, email: user.email, roles: user.roles },
        });

      case "operator-only":
        // Test operator-only access
        requireRoles(user, "operator_field");
        return jsonResponse({
          success: true,
          message: "Operator access verified!",
          user: { id: user.id, email: user.email, roles: user.roles },
        });

      case "auditor-only":
        // Test auditor-only access
        requireRoles(user, "auditor_read");
        return jsonResponse({
          success: true,
          message: "Auditor access verified!",
          user: { id: user.id, email: user.email, roles: user.roles },
        });

      case "level-check":
        // Test authorization level
        const minLevel = parseInt(url.searchParams.get("min_level") || "1");
        if (user.authorization_level < minLevel) {
          return errorResponse(`Requires authorization level ${minLevel}, you have ${user.authorization_level}`, 403);
        }
        return jsonResponse({
          success: true,
          message: `Authorization level ${minLevel}+ verified!`,
          user: {
            id: user.id,
            email: user.email,
            authorization_level: user.authorization_level,
          },
        });

      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error("[test-auth-rbac] Error:", error);
    
    // Handle specific error types
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes("Missing Bearer token") || message.includes("Invalid or expired token")) {
      return errorResponse(message, 401);
    }
    
    if (message.includes("Forbidden") || message.includes("Requires")) {
      return errorResponse(message, 403);
    }
    
    return errorResponse(message, 500);
  }
});
