import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/auth_rbac.ts";

/**
 * AFROLOC - Webhook Receiver
 * 
 * Generic endpoint for receiving AFROLOC webhook events.
 * Validates HMAC-SHA256 signature, processes the event, and stores it.
 * 
 * This function can be used by:
 * - Other AFROLOC apps in the same project (internal)
 * - External apps that subscribe to AFROLOC events (future)
 * 
 * Headers expected:
 *   X-Afroloc-Signature: HMAC-SHA256 hex signature of the body
 *   X-Afroloc-Event: event type (e.g. "address.created")
 *   X-Afroloc-Timestamp: ISO timestamp of dispatch
 * 
 * Supported events:
 *   address.created        — new AFROLOC record created
 *   address.status_changed — status updated (e.g. pending → approved)
 *   address.verified       — verification completed
 *   address.certified      — certification granted
 *   checkin.completed      — resident check-in done
 *   request.created        — new AFROLOC request via SMS/web
 *   request.approved       — request approved by admin
 */

// Webhook shared secret — must match the secret in webhook_subscriptions
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_RECEIVER_SECRET') || '';

/**
 * Verify HMAC-SHA256 signature
 */
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!secret || !signature) return false;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expected = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.text();
    const signature = req.headers.get('x-afroloc-signature') || '';
    const event = req.headers.get('x-afroloc-event') || '';
    const timestamp = req.headers.get('x-afroloc-timestamp') || '';

    // Validate signature if secret is configured
    if (WEBHOOK_SECRET) {
      const isValid = await verifySignature(body, signature, WEBHOOK_SECRET);
      if (!isValid) {
        console.error('[Webhook Receiver] Invalid signature for event:', event);
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check timestamp freshness (reject events older than 5 minutes)
    if (timestamp) {
      const eventTime = new Date(timestamp).getTime();
      const now = Date.now();
      if (Math.abs(now - eventTime) > 5 * 60 * 1000) {
        return new Response(JSON.stringify({ error: 'Event timestamp too old' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const payload = JSON.parse(body);
    console.log(`[Webhook Receiver] Received event: ${event}`, {
      recordId: payload.recordId,
      code: payload.code,
    });

    // Process event based on type
    switch (event || payload.event) {
      case 'address.created': {
        console.log(`[Webhook Receiver] New address created: ${payload.code}`);
        // Store or forward the event as needed
        await supabase.from('security_audit_log').insert({
          action: 'webhook_received_address_created',
          function_name: 'receive-webhook',
          details: {
            afroloc_code: payload.code,
            record_id: payload.recordId,
            status: payload.newStatus,
            source: 'webhook',
          },
        });
        break;
      }

      case 'address.status_changed': {
        console.log(`[Webhook Receiver] Address status changed: ${payload.code} ${payload.oldStatus} → ${payload.newStatus}`);
        await supabase.from('security_audit_log').insert({
          action: 'webhook_received_status_changed',
          function_name: 'receive-webhook',
          details: {
            afroloc_code: payload.code,
            record_id: payload.recordId,
            old_status: payload.oldStatus,
            new_status: payload.newStatus,
            source: 'webhook',
          },
        });
        break;
      }

      case 'address.verified': {
        console.log(`[Webhook Receiver] Address verified: ${payload.code}`);
        await supabase.from('security_audit_log').insert({
          action: 'webhook_received_verified',
          function_name: 'receive-webhook',
          details: {
            afroloc_code: payload.code,
            record_id: payload.recordId,
            source: 'webhook',
          },
        });
        break;
      }

      case 'address.certified': {
        console.log(`[Webhook Receiver] Address certified: ${payload.code}`);
        await supabase.from('security_audit_log').insert({
          action: 'webhook_received_certified',
          function_name: 'receive-webhook',
          details: {
            afroloc_code: payload.code,
            record_id: payload.recordId,
            source: 'webhook',
          },
        });
        break;
      }

      case 'checkin.completed': {
        console.log(`[Webhook Receiver] Check-in completed: ${payload.code}`);
        await supabase.from('security_audit_log').insert({
          action: 'webhook_received_checkin',
          function_name: 'receive-webhook',
          details: {
            afroloc_code: payload.code,
            record_id: payload.recordId,
            user_id: payload.userId,
            source: 'webhook',
          },
        });
        break;
      }

      case 'request.created':
      case 'request.approved': {
        console.log(`[Webhook Receiver] Request event: ${event}`, payload.recordId);
        await supabase.from('security_audit_log').insert({
          action: `webhook_received_${(event || payload.event).replace('.', '_')}`,
          function_name: 'receive-webhook',
          details: {
            record_id: payload.recordId,
            status: payload.newStatus,
            source: 'webhook',
          },
        });
        break;
      }

      default: {
        console.log(`[Webhook Receiver] Unknown event: ${event || payload.event}`);
        await supabase.from('security_audit_log').insert({
          action: 'webhook_received_unknown',
          function_name: 'receive-webhook',
          details: { event: event || payload.event, payload, source: 'webhook' },
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      event: event || payload.event,
      received_at: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[Webhook Receiver] Error:', error);
    return new Response(JSON.stringify({
      error: (error as Error).message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
