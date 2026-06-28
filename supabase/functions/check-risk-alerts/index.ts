import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Starting risk alert check...");

    // Get all address records with user info and alert settings
    const { data: records, error: recordsError } = await supabaseAdmin
      .from('afroloc_records')
      .select(`
        *,
        profiles!afroloc_records_user_id_fkey (
          user_id,
          full_name,
          phone
        )
      `);

    if (recordsError) {
      throw new Error(`Failed to fetch records: ${recordsError.message}`);
    }

    console.log(`Found ${records?.length || 0} records to check`);

    const alertsToSend = [];
    const now = new Date();

    for (const record of records || []) {
      // Calculate risk score
      const hasFullAddress = !!(record.street_name && record.number);
      let riskScore = 0;

      // Address completeness (0-30 points)
      if (!hasFullAddress) {
        riskScore += 30;
      } else {
        riskScore += 5;
      }

      // Cycle progress (0-40 points)
      if (record.next_verification_due) {
        const dueDate = new Date(record.next_verification_due);
        const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilDue < 0) {
          riskScore += 40; // Overdue
        } else if (daysUntilDue < 30) {
          riskScore += 30; // Due soon
        } else if (daysUntilDue < 60) {
          riskScore += 15; // Approaching
        }
      } else {
        riskScore += 40;
      }

      // Verification history (0-30 points)
      if (record.last_verified_at) {
        const cycleDurationMonths = hasFullAddress ? 6 : 3;
        const daysSinceVerification = Math.floor(
          (now.getTime() - new Date(record.last_verified_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        const expectedDays = cycleDurationMonths * 30;

        if (daysSinceVerification > expectedDays * 1.2) {
          riskScore += 30;
        } else if (daysSinceVerification > expectedDays) {
          riskScore += 20;
        } else if (daysSinceVerification > expectedDays * 0.8) {
          riskScore += 10;
        }
      } else {
        riskScore += 30;
      }

      riskScore = Math.min(Math.max(riskScore, 0), 100);

      // Get user alert settings
      const { data: settings } = await supabaseAdmin
        .from('risk_alert_settings')
        .select('*')
        .eq('user_id', record.user_id)
        .single();

      const highThreshold = settings?.high_risk_threshold || 75;
      const criticalThreshold = settings?.critical_risk_threshold || 85;
      const alertType = settings?.alert_type || 'email';
      const enabled = settings?.enabled !== false;

      if (!enabled) continue;

      // Check if alert should be sent
      if (riskScore >= criticalThreshold) {
        alertsToSend.push({
          userId: record.user_id,
          alertType: 'critical_risk',
          riskScore,
          regionName: record.level1_name,
          countryCode: record.country,
          afroidCode: record.code,
          message: `Alerta Crítico: O score de risco para seu endereço ${record.code} atingiu ${riskScore}. Verificação urgente necessária!`,
          sendVia: alertType,
        });
      } else if (riskScore >= highThreshold) {
        // Check if we already sent an alert recently
        const { data: recentAlert } = await supabaseAdmin
          .from('risk_alerts_log')
          .select('sent_at')
          .eq('user_id', record.user_id)
          .gte('sent_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .order('sent_at', { ascending: false })
          .limit(1)
          .single();

        if (!recentAlert) {
          alertsToSend.push({
            userId: record.user_id,
            alertType: 'high_risk',
            riskScore,
            regionName: record.level1_name,
            countryCode: record.country,
            afroidCode: record.code,
            message: `Alerta: O score de risco para seu endereço ${record.code} está em ${riskScore}. Atenção recomendada.`,
            sendVia: alertType,
          });
        }
      }
    }

    console.log(`Sending ${alertsToSend.length} alerts...`);

    // Send alerts
    const results = [];
    for (const alert of alertsToSend) {
      try {
        const response = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-risk-alert`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify(alert),
          }
        );

        const result = await response.json();
        results.push({ alert: alert.afroidCode, success: response.ok, result });
      } catch (error: unknown) {
        const err = error as Error;
        console.error(`Failed to send alert for ${alert.afroidCode}: ${err.message}`);
        results.push({ alert: alert.afroidCode, success: false, error: err.message });
      }
    }

    console.log("Risk alert check completed");

    return new Response(
      JSON.stringify({
        success: true,
        recordsChecked: records?.length || 0,
        alertsSent: alertsToSend.length,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in check-risk-alerts function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
