import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/auth_rbac.ts";

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface NotificationPayload {
  title: string;
  message: string;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  data?: any;
  user_ids?: string[];
}

serve(async (req) => {
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
        },
      }
    );

    const { title, message, priority = 'normal', data = {}, user_ids } = await req.json() as NotificationPayload;

    console.log('[Push] Sending push notification', { title, message, priority, user_ids });

    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: "Title and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get push subscriptions for target users
    let query = supabaseClient
      .from('push_subscriptions')
      .select('user_id, subscription');

    if (user_ids && user_ids.length > 0) {
      query = query.in('user_id', user_ids);
    }

    const { data: subscriptions, error: subError } = await query;

    if (subError) {
      console.error('[Push] Error fetching subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[Push] No subscriptions found');
      return new Response(
        JSON.stringify({ message: "No subscriptions found", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // VAPID keys (you need to generate these using web-push)
    // For production, store these securely in Supabase secrets
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidEmail = Deno.env.get("VAPID_EMAIL") || "mailto:support@afroid.com";

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('[Push] VAPID keys not configured');
      return new Response(
        JSON.stringify({ error: "Push notification service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare notification payload (simplified - just send as text for now)
    const notificationPayload = JSON.stringify({
      title,
      message,
      priority,
      data,
      icon: '/pwa-192x192.png',
      badge: '/apple-touch-icon.png',
      tag: data.tag || 'notification',
      timestamp: Date.now()
    });

    // Send push notifications to all subscriptions
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        const subscription = sub.subscription as unknown as PushSubscription;
        
        // For now, send a simple notification without full encryption
        // In production, use a proper web-push library with VAPID signing
        const response = await fetch(subscription.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'TTL': '86400',
          },
          body: notificationPayload
        });

        if (!response.ok) {
          console.error(`[Push] Failed to send to user ${sub.user_id}:`, response.status);
          
          // Remove invalid subscriptions
          if (response.status === 410 || response.status === 404) {
            await supabaseClient
              .from('push_subscriptions')
              .delete()
              .eq('user_id', sub.user_id);
          }
          return false;
        }

        console.log(`[Push] Successfully sent to user ${sub.user_id}`);
        return true;
      } catch (error) {
        console.error(`[Push] Error sending to user ${sub.user_id}:`, error);
        return false;
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r).length;

    console.log(`[Push] Sent ${successCount}/${subscriptions.length} notifications`);

    return new Response(
      JSON.stringify({ 
        message: "Push notifications sent",
        sent: successCount,
        total: subscriptions.length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Push] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
