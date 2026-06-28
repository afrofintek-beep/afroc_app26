import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const verifySchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
  code: z.string()
    .length(6, "Code must be exactly 6 digits")
    .regex(/^\d{6}$/, "Code must contain only digits"),
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Rate limiting - IP based (10 per 15 minutes)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               req.headers.get('x-real-ip') || 
               'unknown';
    
    const fifteenMinAgo = new Date(Date.now() - 900000).toISOString();
    const { data: recentAttempts } = await supabase
      .from('security_events')
      .select('id')
      .eq('event_type', '2fa_verify_attempt')
      .eq('ip_address', ip)
      .eq('endpoint', '/functions/v1/verify-admin-2fa')
      .gte('created_at', fifteenMinAgo);
    
    if (recentAttempts && recentAttempts.length >= 10) {
      // Log rate limit violation
      await supabase.rpc('log_security_event', {
        p_event_type: 'rate_limit',
        p_severity: 'high',
        p_ip_address: ip,
        p_user_agent: req.headers.get('user-agent'),
        p_endpoint: '/functions/v1/verify-admin-2fa',
        p_details: { limit: 10, period: '15 minutes' }
      });
      
      return new Response(
        JSON.stringify({ error: "Too many verification attempts. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body = await req.json();
    
    // Validate input
    const validationResult = verifySchema.safeParse(body);
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
    
    // Rate limiting - User based (5 attempts per 15 minutes)
    const { data: userAttempts } = await supabase
      .from('security_events')
      .select('id')
      .eq('event_type', '2fa_verify_attempt')
      .eq('user_id', userId)
      .eq('endpoint', '/functions/v1/verify-admin-2fa')
      .gte('created_at', fifteenMinAgo);
    
    if (userAttempts && userAttempts.length >= 5) {
      // Log security event
      await supabase.rpc('log_security_event', {
        p_event_type: 'brute_force_attempt',
        p_severity: 'critical',
        p_user_id: userId,
        p_ip_address: ip,
        p_user_agent: req.headers.get('user-agent'),
        p_endpoint: '/functions/v1/verify-admin-2fa',
        p_details: { limit: 5, period: '15 minutes' }
      });
      
      return new Response(
        JSON.stringify({ error: "Too many failed attempts. Account temporarily locked." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // Log verification attempt
    await supabase.rpc('log_security_event', {
      p_event_type: '2fa_verify_attempt',
      p_severity: 'info',
      p_user_id: userId,
      p_ip_address: ip,
      p_user_agent: req.headers.get('user-agent'),
      p_endpoint: '/functions/v1/verify-admin-2fa',
      p_details: {}
    });

    // Find the most recent unverified code for this user
    const { data: codeData, error: fetchError } = await supabase
      .from("two_factor_codes")
      .select("*")
      .eq("user_id", userId)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !codeData) {
      console.error("Code not found or expired");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid or expired verification code" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify code matches
    if (codeData.code !== code) {
      console.error("Code mismatch");
      
      // Log failed verification attempt
      await supabase.rpc('log_security_event', {
        p_event_type: 'auth_failure',
        p_severity: 'medium',
        p_user_id: userId,
        p_ip_address: ip,
        p_user_agent: req.headers.get('user-agent'),
        p_endpoint: '/functions/v1/verify-admin-2fa',
        p_details: { reason: 'invalid_code' }
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid verification code" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Mark code as verified
    const { error: updateError } = await supabase
      .from("two_factor_codes")
      .update({ 
        verified: true,
        verified_at: new Date().toISOString()
      })
      .eq("id", codeData.id);

    if (updateError) {
      console.error("Failed to update code:", updateError);
      throw new Error("Failed to verify code");
    }

    // Clean up old codes
    await supabase.rpc("cleanup_expired_2fa_codes");

    console.log(`2FA verified successfully for user ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Verification successful" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-admin-2fa:", error);
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
