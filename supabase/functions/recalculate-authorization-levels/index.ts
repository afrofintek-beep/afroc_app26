import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Get all users
    const { data: users, error: usersError } = await supabaseClient.auth.admin.listUsers();

    if (usersError) {
      throw usersError;
    }

    const results = [];

    // Recalculate level for each user
    for (const authUser of users.users) {
      try {
        const { error: updateError } = await supabaseClient.rpc("update_user_authorization_level", {
          _user_id: authUser.id,
        });

        if (updateError) {
          console.error(`Error updating level for user ${authUser.id}:`, updateError);
          results.push({ user_id: authUser.id, success: false, error: updateError.message });
        } else {
          results.push({ user_id: authUser.id, success: true });
        }
      } catch (error) {
        console.error(`Exception updating level for user ${authUser.id}:`, error);
        results.push({ user_id: authUser.id, success: false, error: String(error) });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        message: "Authorization levels recalculated",
        total_users: users.users.length,
        successful: successCount,
        failed: failureCount,
        details: results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
