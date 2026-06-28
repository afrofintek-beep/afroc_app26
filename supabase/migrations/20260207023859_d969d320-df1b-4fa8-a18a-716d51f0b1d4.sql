
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Replace the trigger function to use pg_net
CREATE OR REPLACE FUNCTION public.notify_webhook_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    supabase_url := current_setting('request.headers', true)::json->>'x-supabase-url';
    
    -- Use pg_net to call webhook-dispatch asynchronously
    PERFORM net.http_post(
      url := 'https://rxhtdejvjgopfseysuhl.supabase.co/functions/v1/webhook-dispatch',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('supabase.service_role_key', true) || '"}'::jsonb,
      body := jsonb_build_object(
        'event', 'address.status_changed',
        'recordId', NEW.id,
        'code', NEW.code,
        'oldStatus', OLD.status,
        'newStatus', NEW.status,
        'userId', NEW.user_id,
        'timestamp', now()
      )
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't block the update if webhook dispatch fails
  RAISE WARNING 'Webhook dispatch failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
