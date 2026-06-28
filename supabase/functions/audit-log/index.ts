import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  getCurrentUser,
  requireRoles,
  audit,
  getSupabaseClient,
  errorResponse,
  jsonResponse,
} from "../_shared/auth_rbac.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authenticated user using shared auth module
    const currentUser = await getCurrentUser(req);
    
    // Require admin or auditor role
    requireRoles(currentUser, "admin", "admin_national", "admin_province", "admin_municipality", "auditor_read");

    const supabase = getSupabaseClient();
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    console.log(`[audit-log] Action: ${action}, User: ${currentUser.email}`);

    switch (action) {
      case "list": {
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const actionFilter = url.searchParams.get("actionFilter");
        const userIdFilter = url.searchParams.get("userIdFilter");
        const startDate = url.searchParams.get("startDate");
        const endDate = url.searchParams.get("endDate");

        let query = supabase
          .from("security_audit_log")
          .select("*, profiles:user_id(full_name)", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (actionFilter) {
          query = query.ilike("action", `%${actionFilter}%`);
        }

        if (userIdFilter) {
          query = query.eq("user_id", userIdFilter);
        }

        if (startDate) {
          query = query.gte("created_at", startDate);
        }

        if (endDate) {
          query = query.lte("created_at", endDate);
        }

        const { data: logs, error, count } = await query;

        if (error) throw error;

        return jsonResponse({ logs, total: count });
      }

      case "stats": {
        const days = parseInt(url.searchParams.get("days") || "30");
        const since = new Date();
        since.setDate(since.getDate() - days);

        // Get action counts
        const { data: actionStats } = await supabase
          .from("security_audit_log")
          .select("action")
          .gte("created_at", since.toISOString());

        const actionCounts: Record<string, number> = {};
        actionStats?.forEach((log) => {
          actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
        });

        // Get daily activity
        const { data: dailyStats } = await supabase
          .from("security_audit_log")
          .select("created_at")
          .gte("created_at", since.toISOString());

        const dailyCounts: Record<string, number> = {};
        dailyStats?.forEach((log) => {
          const date = log.created_at.split("T")[0];
          dailyCounts[date] = (dailyCounts[date] || 0) + 1;
        });

        // Get unique users
        const { data: uniqueUsers } = await supabase
          .from("security_audit_log")
          .select("user_id")
          .gte("created_at", since.toISOString());

        const uniqueUserIds = new Set(uniqueUsers?.map((u) => u.user_id).filter(Boolean));

        return jsonResponse({
          actionCounts,
          dailyCounts,
          totalLogs: actionStats?.length || 0,
          uniqueUsers: uniqueUserIds.size,
        });
      }

      case "export": {
        const format = url.searchParams.get("format") || "json";
        const startDate = url.searchParams.get("startDate");
        const endDate = url.searchParams.get("endDate");

        let query = supabase
          .from("security_audit_log")
          .select("*")
          .order("created_at", { ascending: false });

        if (startDate) {
          query = query.gte("created_at", startDate);
        }

        if (endDate) {
          query = query.lte("created_at", endDate);
        }

        const { data: logs, error } = await query;

        if (error) throw error;

        // Log export action using shared audit helper
        await audit(supabase, currentUser.id, "AUDIT_EXPORT", "audit-log:export", {
          format,
          startDate,
          endDate,
          count: logs?.length,
        }, req);

        if (format === "csv") {
          const headers = ["id", "user_id", "action", "function_name", "details", "ip_address", "created_at"];
          const csvRows = [headers.join(",")];
          
          logs?.forEach((log) => {
            const row = headers.map((h) => {
              const val = log[h as keyof typeof log];
              if (typeof val === "object") return JSON.stringify(val).replace(/,/g, ";");
              return String(val || "").replace(/,/g, ";");
            });
            csvRows.push(row.join(","));
          });

          return new Response(csvRows.join("\n"), {
            headers: {
              ...corsHeaders,
              "Content-Type": "text/csv",
              "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().split("T")[0]}.csv"`,
            },
          });
        }

        return jsonResponse({ logs });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("[audit-log] Error:", error);
    
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
