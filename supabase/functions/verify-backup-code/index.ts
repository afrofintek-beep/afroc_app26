import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const verifyBackupCodeSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
  code: z.string()
    .trim()
    .min(1, "Code cannot be empty")
    .max(50, "Code must be less than 50 characters")
    .regex(/^[A-Z0-9\s-]+$/, "Code must contain only uppercase letters, numbers, spaces, and hyphens"),
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    
    // Validate input
    const validationResult = verifyBackupCodeSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input", 
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { userId, code } = validationResult.data;

    // Format the code (remove spaces and convert to uppercase)
    const formattedCode = code.replace(/\s/g, '').toUpperCase();

    // Find the backup code
    const { data: codeData, error: fetchError } = await supabase
      .from("two_factor_backup_codes")
      .select("*")
      .eq("user_id", userId)
      .eq("code", formattedCode)
      .eq("used", false)
      .single();

    if (fetchError || !codeData) {
      console.error("Backup code not found or already used");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid or already used backup code" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get request metadata
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Mark the code as used
    const { error: updateError } = await supabase
      .from("two_factor_backup_codes")
      .update({ 
        used: true,
        used_at: new Date().toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent
      })
      .eq("id", codeData.id);

    if (updateError) {
      console.error("Failed to mark code as used:", updateError);
      throw new Error("Failed to verify backup code");
    }

    // Count remaining unused codes
    const { count } = await supabase
      .from("two_factor_backup_codes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("used", false);

    console.log(`Backup code verified for user ${userId}. Remaining codes: ${count || 0}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Backup code verified successfully",
        remainingCodes: count || 0
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-backup-code:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
