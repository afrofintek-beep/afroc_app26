import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate secret header for internal calls only
    const cleanupSecret = Deno.env.get("CLEANUP_SECRET");
    const authHeader = req.headers.get("authorization");
    
    if (cleanupSecret) {
      if (authHeader !== `Bearer ${cleanupSecret}`) {
        console.error("Unauthorized cleanup attempt", {
          event: "cleanup_unauthorized",
          timestamp: new Date().toISOString()
        });
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    } else {
      console.warn("CLEANUP_SECRET not configured - authentication skipped");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    console.log("Starting OTP cleanup job", {
      event: "cleanup_start",
      timestamp: new Date().toISOString()
    });

    // Delete expired OTPs (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    
    const { data: deletedRecords, error: deleteError } = await supabaseClient
      .from("phone_otp_verifications")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select();

    if (deleteError) {
      console.error("Failed to delete expired OTPs", {
        event: "cleanup_error",
        error: deleteError.message,
        timestamp: new Date().toISOString()
      });
      throw deleteError;
    }

    const deletedCount = deletedRecords?.length || 0;

    // Also clean up old verified OTPs (older than 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 86400000).toISOString();
    
    const { data: oldVerified, error: oldVerifiedError } = await supabaseClient
      .from("phone_otp_verifications")
      .delete()
      .eq("verified", true)
      .lt("verified_at", twentyFourHoursAgo)
      .select();

    if (oldVerifiedError) {
      console.error("Failed to delete old verified OTPs", {
        event: "cleanup_verified_error",
        error: oldVerifiedError.message,
        timestamp: new Date().toISOString()
      });
    }

    const oldVerifiedCount = oldVerified?.length || 0;

    console.log("OTP cleanup completed", {
      event: "cleanup_complete",
      expired_deleted: deletedCount,
      old_verified_deleted: oldVerifiedCount,
      total_deleted: deletedCount + oldVerifiedCount,
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        expired_deleted: deletedCount,
        old_verified_deleted: oldVerifiedCount,
        total_deleted: deletedCount + oldVerifiedCount,
        message: "OTP cleanup completed successfully"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("OTP cleanup job failed", {
      event: "cleanup_job_error",
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
