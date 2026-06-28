import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const verifyOTPSchema = z.object({
  witness_id: z.string().uuid("Invalid witness ID format"),
  otp_code: z.string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d+$/, "OTP must contain only numbers"),
  full_name: z.string().trim().min(3, "Full name must be at least 3 characters"),
  signature: z.string().trim().min(3, "Signature is required"),
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const body = await req.json();
    
    // Validate input
    const validationResult = verifyOTPSchema.safeParse(body);
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

    const { witness_id, otp_code, full_name, signature } = validationResult.data;

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - No authentication token provided" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid authentication token" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("OTP verification attempt", { 
      event: "otp_verify_attempt",
      timestamp: new Date().toISOString()
    });

    // Get witness record and verify ownership
    const { data: witness, error: fetchError } = await supabase
      .from("afroloc_witnesses")
      .select("*")
      .eq("id", witness_id)
      .eq("witness_user_id", user.id) // CRITICAL: Verify the authenticated user is the witness
      .single();

    if (fetchError || !witness) {
      console.log("OTP verification failed", { 
        event: "otp_verify_failed",
        reason: "unauthorized_or_not_found",
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Unauthorized to verify this witness or witness not found" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if OTP exists
    if (!witness.otp_code) {
      return new Response(
        JSON.stringify({ error: "No OTP code generated for this witness" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if OTP has expired
    const expiresAt = new Date(witness.otp_expires_at);
    if (expiresAt < new Date()) {
      return new Response(
        JSON.stringify({ error: "OTP code has expired. Please request a new one." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify OTP code
    if (witness.otp_code !== otp_code) {
      console.log("OTP verification failed", { 
        event: "otp_verify_failed",
        reason: "invalid_code",
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Invalid OTP code" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("OTP verified successfully", { 
      event: "otp_verify_success",
      timestamp: new Date().toISOString()
    });

    // Update witness status to confirmed with signature
    const { error: updateError } = await supabase
      .from("afroloc_witnesses")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        signature: `${full_name} - ${signature} - ${new Date().toISOString()}`,
        otp_code: null, // Clear OTP after successful verification
        otp_expires_at: null,
      })
      .eq("id", witness_id);

    if (updateError) {
      console.error("Database update failed", { 
        event: "db_error",
        timestamp: new Date().toISOString()
      });
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Witness confirmed successfully",
        witness_id: witness_id,
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
    console.error("OTP verification exception", { 
      event: "verification_exception",
      timestamp: new Date().toISOString()
    });
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
