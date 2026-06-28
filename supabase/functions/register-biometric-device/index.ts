import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/auth_rbac.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: req.headers.get("Authorization")!,
          },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const {
      phone_number,
      device_name,
      device_type,
      device_fingerprint,
      browser,
      os,
      biometry_type,
    } = await req.json();

    if (!phone_number) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Generate secure device token
    const deviceToken = crypto.randomUUID() + "-" + crypto.randomUUID();

    // Create service role client for inserting
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Store device token
    const { data, error } = await supabaseAdmin
      .from("biometric_devices")
      .insert({
        user_id: user.id,
        phone_number,
        device_token: deviceToken,
        device_name,
        device_type,
        device_fingerprint,
        browser,
        os,
        biometry_type,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to register biometric device", {
        event: "device_registration_failed",
        user_id: user.id,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ error: "Failed to register device" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Biometric device registered", {
      event: "device_registered",
      user_id: user.id,
      device_id: data.id,
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        device_token: deviceToken,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Register biometric device error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});