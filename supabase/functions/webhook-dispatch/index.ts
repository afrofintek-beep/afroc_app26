import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/auth_rbac.ts";

/**
 * WEBHOOK DISPATCH
 * 
 * Called internally (by DB trigger or other functions) when address events occur.
 * Finds all active subscriptions matching the event and delivers the payload.
 * 
 * POST body:
 *   event: string         — e.g. "address.status_changed"
 *   recordId: string
 *   code: string
 *   oldStatus: string
 *   newStatus: string
 *   userId: string
 *   timestamp: string
 * 
 * Supported events:
 *   address.status_changed  — status field updated
 *   address.created         — new record inserted
 *   address.verified        — verification completed
 *   address.certified       — certification granted
 *   checkin.completed       — resident check-in done
 */

interface WebhookPayload {
  event: string;
  recordId: string;
  code?: string;
  oldStatus?: string;
  newStatus?: string;
  userId?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Deliver webhook to a single subscription
 */
async function deliverWebhook(
  supabase: ReturnType<typeof createClient>,
  subscriptionId: string,
  url: string,
  secret: string,
  event: string,
  payload: WebhookPayload
): Promise<{ success: boolean; status?: number; error?: string }> {
  const body = JSON.stringify(payload);
  const signature = await signPayload(body, secret);
  const timestamp = new Date().toISOString();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Afroloc-Signature': signature,
        'X-Afroloc-Event': event,
        'X-Afroloc-Timestamp': timestamp,
        'User-Agent': 'AFROLOC-Webhook/1.0',
      },
      body,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    const responseBody = await response.text().catch(() => '');

    // Log the delivery
    await supabase.from('webhook_logs').insert({
      subscription_id: subscriptionId,
      event,
      payload,
      response_status: response.status,
      response_body: responseBody.substring(0, 1000),
      delivered_at: response.ok ? new Date().toISOString() : null,
      failed_at: response.ok ? null : new Date().toISOString(),
      error_message: response.ok ? null : `HTTP ${response.status}`,
    });

    return { success: response.ok, status: response.status };
  } catch (error: unknown) {
    const errMsg = (error as Error).message;

    await supabase.from('webhook_logs').insert({
      subscription_id: subscriptionId,
      event,
      payload,
      failed_at: new Date().toISOString(),
      error_message: errMsg,
    });

    return { success: false, error: errMsg };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: WebhookPayload = await req.json();
    const { event } = payload;

    if (!event) {
      return new Response(JSON.stringify({ error: 'Missing event field' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Webhook] Dispatching event: ${event} for record: ${payload.recordId}`);

    // Find all active subscriptions that listen to this event
    const { data: subscriptions, error: subErr } = await supabase
      .from('webhook_subscriptions')
      .select('id, url, secret, name')
      .eq('is_active', true)
      .contains('events', [event]);

    if (subErr) {
      throw new Error(`Failed to fetch subscriptions: ${subErr.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[Webhook] No active subscriptions for event: ${event}`);
      return new Response(JSON.stringify({
        success: true,
        dispatched: 0,
        message: 'No active subscriptions for this event',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Deliver to all matching subscriptions in parallel
    const results = await Promise.allSettled(
      subscriptions.map(sub =>
        deliverWebhook(supabase, sub.id, sub.url, sub.secret, event, payload)
      )
    );

    const delivered = results.filter(
      r => r.status === 'fulfilled' && r.value.success
    ).length;
    const failed = results.length - delivered;

    console.log(`[Webhook] Event ${event}: ${delivered} delivered, ${failed} failed out of ${subscriptions.length}`);

    return new Response(JSON.stringify({
      success: true,
      event,
      dispatched: subscriptions.length,
      delivered,
      failed,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[Webhook] Dispatch error:', error);
    return new Response(JSON.stringify({
      error: (error as Error).message,
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
