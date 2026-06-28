import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Starting weekly analytics report generation", {
      event: "weekly_report_start",
      timestamp: new Date().toISOString()
    });

    // Get date range for the past week
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    // Fetch downloads for the past week
    const { data: weeklyDownloads, error: downloadsError } = await supabase
      .from("witness_contract_downloads")
      .select("*")
      .gte("downloaded_at", startDate.toISOString())
      .lte("downloaded_at", endDate.toISOString());

    if (downloadsError) {
      console.error("Failed to fetch downloads", downloadsError);
      throw downloadsError;
    }

    // Fetch all-time downloads for comparison
    const { data: allDownloads, error: allDownloadsError } = await supabase
      .from("witness_contract_downloads")
      .select("id");

    if (allDownloadsError) {
      console.error("Failed to fetch all downloads", allDownloadsError);
    }

    // Calculate statistics
    const stats = {
      totalDownloads: weeklyDownloads?.length || 0,
      emailSuccessCount: weeklyDownloads?.filter(d => d.email_sent).length || 0,
      whatsappSuccessCount: weeklyDownloads?.filter(d => d.whatsapp_sent).length || 0,
      bothSuccessCount: weeklyDownloads?.filter(d => d.email_sent && d.whatsapp_sent).length || 0,
      emailSuccessRate: weeklyDownloads?.length ? 
        ((weeklyDownloads.filter(d => d.email_sent).length / weeklyDownloads.length) * 100).toFixed(1) : "0",
      whatsappSuccessRate: weeklyDownloads?.length ?
        ((weeklyDownloads.filter(d => d.whatsapp_sent).length / weeklyDownloads.length) * 100).toFixed(1) : "0",
      allTimeTotal: allDownloads?.length || 0,
    };

    // Get previous week for trend comparison
    const prevWeekStart = new Date(startDate);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    
    const { data: prevWeekDownloads } = await supabase
      .from("witness_contract_downloads")
      .select("id")
      .gte("downloaded_at", prevWeekStart.toISOString())
      .lt("downloaded_at", startDate.toISOString());

    const trend = prevWeekDownloads?.length 
      ? ((stats.totalDownloads - prevWeekDownloads.length) / prevWeekDownloads.length * 100).toFixed(1)
      : "0";

    // Daily breakdown for the week
    const dailyBreakdown = new Map<string, number>();
    weeklyDownloads?.forEach(download => {
      const date = new Date(download.downloaded_at).toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
      dailyBreakdown.set(date, (dailyBreakdown.get(date) || 0) + 1);
    });

    const dailyRows = Array.from(dailyBreakdown.entries())
      .map(([date, count]) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${date}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${count}</td>
        </tr>
      `).join('');

    // Get all admin users
    const { data: adminUsers, error: adminError } = await supabase
      .from("user_authorization_levels")
      .select("user_id")
      .gte("current_level", 2);

    if (adminError) {
      console.error("Failed to fetch admin users", adminError);
      throw adminError;
    }

    if (!adminUsers || adminUsers.length === 0) {
      console.log("No admin users found");
      return new Response(
        JSON.stringify({ message: "No admin users to send report to" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get admin emails
    const adminUserIds = adminUsers.map(u => u.user_id);
    const adminEmails: string[] = [];

    for (const userId of adminUserIds) {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        adminEmails.push(userData.user.email);
      }
    }

    if (adminEmails.length === 0) {
      console.log("No admin emails found");
      return new Response(
        JSON.stringify({ message: "No admin emails found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate and send email report
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; margin: 0; padding: 0; }
            .container { max-width: 700px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; }
            .header p { margin: 10px 0 0; opacity: 0.9; }
            .content { padding: 30px; }
            .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 30px 0; }
            .stat-card { background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #667eea; }
            .stat-card.success { border-left-color: #10b981; }
            .stat-card.warning { border-left-color: #f59e0b; }
            .stat-value { font-size: 36px; font-weight: bold; color: #1f2937; margin: 10px 0; }
            .stat-label { font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
            .stat-sublabel { font-size: 12px; color: #9ca3af; margin-top: 5px; }
            .section { margin: 30px 0; }
            .section-title { font-size: 18px; font-weight: 600; color: #1f2937; margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
            .table { width: 100%; border-collapse: collapse; }
            .trend { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
            .trend.up { background: #d1fae5; color: #065f46; }
            .trend.down { background: #fee2e2; color: #991b1b; }
            .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 12px; }
            .btn { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📊 Weekly Analytics Report</h1>
              <p>Contract Downloads & Notifications Summary</p>
              <p style="font-size: 14px; margin-top: 10px;">
                ${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - 
                ${endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            <div class="content">
              <!-- Key Metrics -->
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">Total Downloads</div>
                  <div class="stat-value">${stats.totalDownloads}</div>
                  <div class="stat-sublabel">
                    ${Number(trend) >= 0 
                      ? `<span class="trend up">↑ ${trend}%</span>`
                      : `<span class="trend down">↓ ${Math.abs(Number(trend))}%</span>`
                    } vs last week
                  </div>
                </div>

                <div class="stat-card success">
                  <div class="stat-label">Both Notifications</div>
                  <div class="stat-value">${stats.bothSuccessCount}</div>
                  <div class="stat-sublabel">Email & WhatsApp sent</div>
                </div>

                <div class="stat-card success">
                  <div class="stat-label">Email Success Rate</div>
                  <div class="stat-value">${stats.emailSuccessRate}%</div>
                  <div class="stat-sublabel">${stats.emailSuccessCount} of ${stats.totalDownloads} sent</div>
                </div>

                <div class="stat-card success">
                  <div class="stat-label">WhatsApp Success Rate</div>
                  <div class="stat-value">${stats.whatsappSuccessRate}%</div>
                  <div class="stat-sublabel">${stats.whatsappSuccessCount} of ${stats.totalDownloads} sent</div>
                </div>
              </div>

              <!-- Daily Breakdown -->
              ${dailyRows ? `
                <div class="section">
                  <div class="section-title">Daily Breakdown</div>
                  <table class="table">
                    <thead>
                      <tr style="background: #f3f4f6;">
                        <th style="padding: 12px; text-align: left; font-weight: 600; color: #6b7280;">Date</th>
                        <th style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">Downloads</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${dailyRows}
                    </tbody>
                  </table>
                </div>
              ` : ''}

              <!-- All-Time Stats -->
              <div class="section">
                <div class="section-title">All-Time Statistics</div>
                <p style="color: #6b7280;">
                  Total contract downloads since launch: <strong style="color: #1f2937; font-size: 18px;">${stats.allTimeTotal}</strong>
                </p>
              </div>

              <!-- CTA -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="${Deno.env.get("SUPABASE_URL")?.replace('https://', 'https://app.')}/admin/contract-downloads" class="btn">
                  View Full Dashboard
                </a>
              </div>
            </div>

            <div class="footer">
              <p><strong>AFROLOC Admin Report</strong></p>
              <p>This is an automated weekly report. You're receiving this because you're an administrator.</p>
              <p style="margin-top: 15px;">© ${new Date().getFullYear()} AFROLOC. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email to all admins
    const emailPromises = adminEmails.map(email => 
      resend.emails.send({
        from: "AFROLOC Analytics <onboarding@resend.dev>",
        to: [email],
        subject: `📊 Weekly Analytics Report - ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        html: emailHtml,
      })
    );

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(r => r.status === "fulfilled").length;
    const failureCount = results.filter(r => r.status === "rejected").length;

    console.log("Weekly report sent", {
      event: "weekly_report_complete",
      successCount,
      failureCount,
      totalRecipients: adminEmails.length,
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Weekly analytics report sent",
        recipients: adminEmails.length,
        successCount,
        failureCount,
        stats,
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
    console.error("Weekly report error", error);
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
