import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const reminderSchema = z.object({
  hours_threshold: z.number().min(1).max(168).optional().default(24),
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const body = await req.json().catch(() => ({}));
    
    // Validate input
    const validationResult = reminderSchema.safeParse(body);
    if (!validationResult.success) {
      console.error("Invalid input", {
        event: "validation_error",
        errors: validationResult.error.issues,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: "Invalid request parameters" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { hours_threshold } = validationResult.data;

    console.log("Checking for pending validations needing reminders", {
      event: "reminder_check_start",
      hours_threshold,
      timestamp: new Date().toISOString()
    });

    // Find witnesses pending for more than specified hours
    const thresholdTime = new Date(Date.now() - hours_threshold * 60 * 60 * 1000).toISOString();

    const { data: pendingWitnesses, error } = await supabaseClient
      .from("afroloc_witnesses")
      .select(`
        id,
        witness_afro_id,
        otp_code,
        otp_sent_at,
        afroloc_records (
          code,
          geo_lat,
          geo_lon
        )
      `)
      .eq("status", "pending")
      .lt("otp_sent_at", thresholdTime)
      .gt("otp_expires_at", new Date().toISOString());

    if (error) {
      console.error("Database query failed", {
        event: "db_error",
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw new Error("Data retrieval failed");
    }

    console.log(`Found ${pendingWitnesses?.length || 0} witnesses needing reminders`, {
      event: "reminders_found",
      count: pendingWitnesses?.length || 0,
      timestamp: new Date().toISOString()
    });

    if (!pendingWitnesses || pendingWitnesses.length === 0) {
      return new Response(
        JSON.stringify({ success: true, reminders_sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error("Twilio credentials not configured");
      throw new Error("Service configuration error");
    }

    let remindersSent = 0;

    for (const witness of pendingWitnesses) {
      try {
        const validationNumber = witness.otp_code; // Phone number stored as otp_code
        
        // Build address with geo coordinates
        const afrolocRecord = witness.afroloc_records?.[0];
        const geoCoords = afrolocRecord?.geo_lat && afrolocRecord?.geo_lon 
          ? `(${afrolocRecord.geo_lat}, ${afrolocRecord.geo_lon})`
          : "";
        const address = geoCoords 
          ? `${afrolocRecord?.code} ${geoCoords}`
          : afrolocRecord?.code;

        const reminderMessage = `LEMBRETE AFROLOC: Você ainda não respondeu à validação do endereço ${address}. Por favor, responda SIM ou NÃO.`;

        const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
        
        const smsResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${twilioAuth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: validationNumber,
              From: twilioPhoneNumber,
              Body: reminderMessage,
            }).toString(),
          }
        );

        if (smsResponse.ok) {
          remindersSent++;
          console.log("Reminder sent successfully", {
            event: "reminder_sent",
            witness_id: witness.id,
            timestamp: new Date().toISOString()
          });
        } else {
          console.error("Reminder failed", {
            event: "reminder_failed",
            witness_id: witness.id,
            status: smsResponse.status,
            timestamp: new Date().toISOString()
          });
        }
      } catch (smsError: any) {
        console.error("SMS error for witness", {
          event: "sms_error",
          witness_id: witness.id,
          error: smsError.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    console.log("Reminders completed", {
      event: "reminders_complete",
      total_sent: remindersSent,
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ success: true, reminders_sent: remindersSent }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Reminder job failed", {
      event: "reminder_error",
      error: error.message,
      timestamp: new Date().toISOString()
    });
    return new Response(
      JSON.stringify({ error: "Request processing failed" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
