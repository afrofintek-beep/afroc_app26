import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/auth_rbac.ts";

// Generate a secure random backup code
function generateBackupCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  
  for (let i = 0; i < 8; i++) {
    code += chars[array[i] % chars.length];
  }
  
  // Format as XXXX-XXXX for readability
  return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Verify user has admin role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      throw new Error("Admin access required");
    }

    // Delete any existing unused backup codes for this user
    await supabase
      .from("two_factor_backup_codes")
      .delete()
      .eq("user_id", user.id)
      .eq("used", false);

    // Generate 10 new backup codes
    const codes: string[] = [];
    const codeRecords = [];

    for (let i = 0; i < 10; i++) {
      const code = generateBackupCode();
      codes.push(code);
      codeRecords.push({
        user_id: user.id,
        code,
      });
    }

    // Insert the new backup codes
    const { error: insertError } = await supabase
      .from("two_factor_backup_codes")
      .insert(codeRecords);

    if (insertError) {
      console.error("Failed to insert backup codes:", insertError);
      throw new Error("Failed to generate backup codes");
    }

    console.log(`Generated ${codes.length} backup codes for user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        codes,
        message: "Backup codes generated successfully"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in generate-backup-codes:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message === "Unauthorized" || error.message === "Admin access required" ? 403 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
