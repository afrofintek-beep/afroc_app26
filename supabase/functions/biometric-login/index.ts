import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/auth_rbac.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { phone_number, device_token, device_fingerprint } = await req.json();

    if (!phone_number || !device_token) {
      console.error("Missing required fields", { phone_number: !!phone_number, device_token: !!device_token });
      return new Response(
        JSON.stringify({ error: "Phone number and device token are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Checking device token for phone:", phone_number);

    // Validate device token with fingerprint check
    let query = supabaseAdmin
      .from("biometric_devices")
      .select("*")
      .eq("phone_number", phone_number)
      .eq("device_token", device_token)
      .gt("expires_at", new Date().toISOString());
    
    if (device_fingerprint) {
      query = query.eq("device_fingerprint", device_fingerprint);
    }

    const { data: device, error: deviceError } = await query.maybeSingle();

    if (deviceError) {
      console.error("Database error:", deviceError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!device) {
      console.error("Invalid or expired device token", {
        event: "biometric_auth_failed",
        phone: phone_number,
        timestamp: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ error: "Invalid or expired biometric credentials" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Device found, user_id:", device.user_id);

    // Update last used timestamp
    await supabaseAdmin
      .from("biometric_devices")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", device.id);

    // Get user data
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(device.user_id);
    
    if (userError || !userData?.user) {
      console.error("User not found:", userError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("User found, creating session via email OTP");

    // Use signInWithOtp to trigger an email OTP - but we'll intercept and use directly
    // Instead, we'll use the admin API to generate a link and then verify it server-side
    
    // Generate a signup/magiclink that we can use
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email!,
    });

    if (linkError || !linkData) {
      console.error("Failed to generate link:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to generate authentication" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // The linkData contains user and session info we can use
    // Actually, for admin-generated links, we need to verify on server
    // Let's call the verify endpoint ourselves with the token
    
    const actionLink = linkData.properties?.action_link;
    if (!actionLink) {
      console.error("No action link generated");
      return new Response(
        JSON.stringify({ error: "Failed to generate link" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Call the verify endpoint from the server to get a valid session
    const verifyUrl = actionLink.replace('/auth/v1/verify', '/auth/v1/verify');
    
    console.log("Calling verify endpoint from server");
    
    const verifyResponse = await fetch(actionLink, {
      method: 'GET',
      redirect: 'manual', // Don't follow redirects
    });

    // The verify endpoint returns a redirect with tokens in the fragment
    const locationHeader = verifyResponse.headers.get('location');
    
    if (!locationHeader) {
      console.error("No redirect from verify endpoint, status:", verifyResponse.status);
      
      // Try alternative: use the token directly with the token endpoint
      const url = new URL(actionLink);
      const token = url.searchParams.get('token');
      const type = url.searchParams.get('type');
      
      if (token && type) {
        // Call the token endpoint with the OTP
        const tokenEndpoint = `${Deno.env.get("SUPABASE_URL")}/auth/v1/token?grant_type=id_token`;
        
        // Actually, let's try verify with POST
        const verifyPostUrl = `${Deno.env.get("SUPABASE_URL")}/auth/v1/verify`;
        const verifyPostResponse = await fetch(verifyPostUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          },
          body: JSON.stringify({
            type: type,
            token: token,
          }),
        });
        
        const verifyData = await verifyPostResponse.json();
        console.log("Verify POST response status:", verifyPostResponse.status);
        
        if (verifyPostResponse.ok && verifyData.access_token) {
          console.log("Session created via verify POST", {
            event: "biometric_auth_success",
            user_id: device.user_id,
            timestamp: new Date().toISOString(),
          });
          
          return new Response(
            JSON.stringify({
              success: true,
              access_token: verifyData.access_token,
              refresh_token: verifyData.refresh_token,
              user: verifyData.user,
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        } else {
          console.error("Verify POST failed:", verifyData);
        }
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to verify authentication" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse tokens from the redirect URL fragment
    // Format: ...#access_token=XXX&refresh_token=XXX&...
    const fragmentIndex = locationHeader.indexOf('#');
    if (fragmentIndex === -1) {
      console.error("No fragment in redirect URL");
      return new Response(
        JSON.stringify({ error: "Invalid authentication response" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const fragment = locationHeader.substring(fragmentIndex + 1);
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      console.error("Missing tokens in redirect");
      return new Response(
        JSON.stringify({ error: "Failed to obtain session tokens" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Session created successfully", {
      event: "biometric_auth_success",
      user_id: device.user_id,
      device_id: device.id,
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        access_token: accessToken,
        refresh_token: refreshToken,
        user: userData.user,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Biometric login error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
