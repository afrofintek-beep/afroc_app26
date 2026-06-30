import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";
import { sendSms } from "../_shared/sms.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const twoFactorSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
  method: z.enum(['email', 'sms'], { errorMap: () => ({ message: "Method must be 'email' or 'sms'" }) }),
  email: z.string().email("Invalid email format").optional(),
  phone: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format (E.164 format required)")
    .optional(),
}).refine(
  (data) => {
    if (data.method === 'email' && !data.email) return false;
    if (data.method === 'sms' && !data.phone) return false;
    return true;
  },
  {
    message: "Email is required when method is 'email', phone is required when method is 'sms'",
  }
);

// Generate 6-digit code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Rate limiting - IP based (5 per hour)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               req.headers.get('x-real-ip') || 
               'unknown';
    
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data: recentAttempts } = await supabase
      .from('security_events')
      .select('id')
      .eq('event_type', '2fa_request')
      .eq('ip_address', ip)
      .eq('endpoint', '/functions/v1/send-admin-2fa')
      .gte('created_at', oneHourAgo);
    
    if (recentAttempts && recentAttempts.length >= 5) {
      // Log rate limit violation
      await supabase.rpc('log_security_event', {
        p_event_type: 'rate_limit',
        p_severity: 'high',
        p_ip_address: ip,
        p_user_agent: req.headers.get('user-agent'),
        p_endpoint: '/functions/v1/send-admin-2fa',
        p_details: { limit: 5, period: '1 hour' }
      });
      
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body = await req.json();
    
    // Validate input
    const validationResult = twoFactorSchema.safeParse(body);
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

    const { userId, method, email, phone } = validationResult.data;
    
    // Rate limiting - User based (3 per hour)
    const { data: userAttempts } = await supabase
      .from('security_events')
      .select('id')
      .eq('event_type', '2fa_request')
      .eq('user_id', userId)
      .eq('endpoint', '/functions/v1/send-admin-2fa')
      .gte('created_at', oneHourAgo);
    
    if (userAttempts && userAttempts.length >= 3) {
      return new Response(
        JSON.stringify({ error: "Too many 2FA requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // Log this 2FA request
    await supabase.rpc('log_security_event', {
      p_event_type: '2fa_request',
      p_severity: 'info',
      p_user_id: userId,
      p_ip_address: ip,
      p_user_agent: req.headers.get('user-agent'),
      p_endpoint: '/functions/v1/send-admin-2fa',
      p_details: { method }
    });

    // Generate 2FA code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Get request metadata
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Store code in database
    const { error: dbError } = await supabase
      .from("two_factor_codes")
      .insert({
        user_id: userId,
        code,
        method,
        expires_at: expiresAt.toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to store verification code");
    }

    // Send code based on method
    if (method === 'email' && email) {
      const emailResponse = await resend.emails.send({
        from: "AFROLOC Security <onboarding@resend.dev>",
        to: [email],
        subject: "Your Admin 2FA Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333; border-bottom: 3px solid #4F46E5; padding-bottom: 10px;">
              Admin Security Verification
            </h1>
            <p style="font-size: 16px; color: #555;">
              A login attempt was made to your administrator account. Please use the verification code below to complete your login:
            </p>
            <div style="background: #f4f4f4; border: 2px solid #4F46E5; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
              <h2 style="margin: 0; color: #4F46E5; font-size: 32px; letter-spacing: 5px;">
                ${code}
              </h2>
            </div>
            <p style="font-size: 14px; color: #666;">
              This code will expire in <strong>10 minutes</strong>.
            </p>
            <p style="font-size: 14px; color: #666;">
              <strong>Security Information:</strong><br>
              IP Address: ${ipAddress}<br>
              Time: ${new Date().toLocaleString()}
            </p>
            <p style="font-size: 14px; color: #999; border-top: 1px solid #ddd; padding-top: 15px; margin-top: 20px;">
              If you did not attempt to log in, please secure your account immediately and contact system administrators.
            </p>
          </div>
        `,
      });

      console.log("Email sent:", emailResponse);
    } else if (method === 'sms' && phone) {
      // SMS sending via Infobip (helper partilhado _shared/sms.ts).
      const smsMessage = `Your AFROLOC admin verification code is: ${code}. Valid for 10 minutes. Do not share this code.`;

      const smsResult = await sendSms(phone, smsMessage);
      if (!smsResult.ok) {
        console.error("SMS send failed (Infobip)", { error: smsResult.error });
        throw new Error("Falha ao enviar SMS. " + (smsResult.error ?? "Tente novamente."));
      }

      console.log("SMS sent successfully");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Verification code sent via ${method}`,
        expiresAt: expiresAt.toISOString()
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-admin-2fa:", error);
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
