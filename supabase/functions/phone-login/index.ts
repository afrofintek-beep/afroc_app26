import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const phoneLoginSchema = z.object({
  phone: z.string()
    .trim()
    .min(10, "Phone number must be at least 10 digits")
    .max(20, "Phone number must be less than 20 characters"),
  otp_code: z.string()
    .trim()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d{6}$/, "OTP must contain only digits"),
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const body = await req.json();
    
    // Validate input
    const validationResult = phoneLoginSchema.safeParse(body);
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

    const { phone, otp_code } = validationResult.data;

    console.log("Phone login initiated", { 
      event: "phone_login_start",
      phone: phone.substring(0, 5) + "***",
      timestamp: new Date().toISOString()
    });

    // Verify OTP
    const { data: otpRecord, error: fetchError } = await supabaseClient
      .from("phone_otp_verifications")
      .select("*")
      .eq("phone_number", phone)
      .single();

    if (fetchError || !otpRecord) {
      console.error("OTP verification failed", { 
        event: "otp_not_found",
        error: fetchError?.message,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Authentication failed. Please check your credentials." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if OTP is expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      console.error("OTP expired", { 
        event: "otp_expired",
        expires_at: otpRecord.expires_at,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Authentication failed. Please request a new code." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // In development, reset verified status if OTP is being reused (for testing)
    const isDevelopment = Deno.env.get("ENVIRONMENT") === "development" || 
                          req.headers.get('origin')?.includes('preview.example') ||
                          req.headers.get('origin')?.includes('localhost');
    
    if (otpRecord.verified) {
      if (isDevelopment) {
        // Reset verification status in development to allow retesting
        console.log("Resetting OTP verification status for testing", {
          event: "otp_reset_dev",
          timestamp: new Date().toISOString()
        });
        
        await supabaseClient
          .from("phone_otp_verifications")
          .update({ 
            verified: false,
            verified_at: null,
            attempts: 0
          })
          .eq("phone_number", phone);
          
        // Re-fetch the updated record
        const { data: refreshedOtp } = await supabaseClient
          .from("phone_otp_verifications")
          .select("*")
          .eq("phone_number", phone)
          .single();
          
        if (refreshedOtp) {
          Object.assign(otpRecord, refreshedOtp);
        }
      } else {
        return new Response(
          JSON.stringify({ error: "Código OTP já utilizado" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // Check if max attempts reached
    if (otpRecord.attempts >= 3) {
      console.error("Max OTP attempts reached", { 
        event: "otp_max_attempts",
        attempts: otpRecord.attempts,
        timestamp: new Date().toISOString()
      });
      
      // Log security event
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                 req.headers.get('x-real-ip') || 
                 'unknown';
      
      await supabaseClient.rpc('log_security_event', {
        p_event_type: 'otp_max_attempts',
        p_severity: 'high',
        p_ip_address: ip,
        p_user_agent: req.headers.get('user-agent'),
        p_endpoint: '/functions/v1/phone-login',
        p_details: { phone_masked: phone.substring(0, 5) + '***', attempts: otpRecord.attempts }
      });
      
      return new Response(
        JSON.stringify({ 
          error: "Máximo de tentativas excedido. Solicite um novo código OTP.",
          max_attempts_reached: true
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify OTP code
    if (otpRecord.otp_code !== otp_code) {
      // Increment attempts counter
      const newAttempts = (otpRecord.attempts || 0) + 1;
      await supabaseClient
        .from("phone_otp_verifications")
        .update({ attempts: newAttempts })
        .eq("phone_number", phone);
      
      console.error("Invalid OTP code", { 
        event: "otp_invalid",
        attempts: newAttempts,
        remaining: 3 - newAttempts,
        timestamp: new Date().toISOString()
      });
      
      const remainingAttempts = 3 - newAttempts;
      const errorMessage = remainingAttempts > 0
        ? `Código OTP inválido. ${remainingAttempts} tentativa(s) restante(s).`
        : "Máximo de tentativas excedido. Solicite um novo código OTP.";
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          remaining_attempts: Math.max(0, remainingAttempts)
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Find user by phone number in profiles (use limit + order to get most recent if duplicates exist)
    const { data: profiles, error: profileError } = await supabaseClient
      .from("profiles")
      .select("user_id")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1);

    const profile = profiles?.[0] || null;

    if (profileError) {
      console.error("Profile query error", { 
        event: "profile_query_error",
        error: profileError.message,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable. Please try again." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    let userId: string;
    let isNewUser = false;

    if (!profile) {
      // New user signup - create account
      console.log("Creating new user account", { 
        event: "user_signup",
        phone: phone.substring(0, 5) + "***",
        timestamp: new Date().toISOString()
      });
      
      // Create auth user with phone as email (temporary)
      const tempEmail = `${phone.replace(/[^0-9]/g, '')}@temp.afroid.app`;
      const tempPassword = crypto.randomUUID();
      
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email: tempEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          phone: phone,
          signup_method: 'phone_otp'
        }
      });

      if (authError || !authData.user) {
        console.error("Failed to create user", { 
          event: "user_creation_failed",
          error: authError?.message,
          timestamp: new Date().toISOString()
        });
        return new Response(
          JSON.stringify({ error: "Unable to create account. Please try again." }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      userId = authData.user.id;
      isNewUser = true;

      // Create profile
      const { error: profileInsertError } = await supabaseClient
        .from("profiles")
        .insert({
          user_id: userId,
          phone: phone,
          onboarding_completed: false
        });

      if (profileInsertError) {
        console.error("Failed to create profile", { 
          event: "profile_creation_failed",
          error: profileInsertError.message,
          timestamp: new Date().toISOString()
        });
        // Continue anyway - profile trigger might handle this
      }

      console.log("New user account created", { 
        event: "user_created",
        user_id: userId,
        timestamp: new Date().toISOString()
      });
    } else {
      // Existing user login
      userId = profile.user_id;
      console.log("Existing user login", { 
        event: "user_login",
        user_id: userId,
        timestamp: new Date().toISOString()
      });
    }

    // Mark OTP as verified and reset attempts counter
    await supabaseClient
      .from("phone_otp_verifications")
      .update({ 
        verified: true,
        verified_at: new Date().toISOString(),
        attempts: 0
      })
      .eq("phone_number", phone);

    // Generate a temporary password for this session
    const tempPassword = crypto.randomUUID();
    
    // Get user email first
    const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(userId);
    
    if (userError || !userData.user || !userData.user.email) {
      console.error("Failed to get user data", { 
        event: "user_fetch_failed",
        error: userError?.message,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable. Please try again." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Update user password
    const { error: passwordError } = await supabaseClient.auth.admin.updateUserById(
      userId,
      { password: tempPassword }
    );
    
    if (passwordError) {
      console.error("Failed to update password", { 
        event: "password_update_failed",
        error: passwordError.message,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable. Please try again." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create a regular (non-admin) client for signing in
    const regularClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Sign in with password to get actual session tokens
    const { data: sessionData, error: signInError } = await regularClient.auth.signInWithPassword({
      email: userData.user.email,
      password: tempPassword,
    });

    if (signInError || !sessionData.session) {
      console.error("Failed to create session", { 
        event: "session_creation_failed",
        error: signInError?.message,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable. Please try again." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const accessToken = sessionData.session.access_token;
    const refreshToken = sessionData.session.refresh_token;

    console.log("Phone login successful", { 
      event: "phone_login_success",
      user_id: userId,
      is_new_user: isNewUser,
      timestamp: new Date().toISOString()
    });

    // Return authentication tokens for client
    return new Response(
      JSON.stringify({ 
        success: true,
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: userId,
          phone: phone,
        },
        is_new_user: isNewUser,
        message: isNewUser ? "Conta criada com sucesso" : "Login realizado com sucesso"
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
    console.error("Phone login failed", { 
      event: "phone_login_error",
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
    return new Response(
      JSON.stringify({ error: "Service temporarily unavailable. Please try again." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
