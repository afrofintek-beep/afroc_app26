
-- =============================================
-- AFROLOC WEBHOOK SYSTEM
-- =============================================

-- 1. Webhook subscriptions
CREATE TABLE public.webhook_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Webhook delivery logs
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX idx_webhook_subs_user ON public.webhook_subscriptions(user_id);
CREATE INDEX idx_webhook_subs_active ON public.webhook_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX idx_webhook_logs_sub ON public.webhook_logs(subscription_id);
CREATE INDEX idx_webhook_logs_created ON public.webhook_logs(created_at DESC);

-- 4. RLS
ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own subscriptions"
  ON public.webhook_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
  ON public.webhook_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_authorization_levels
      WHERE user_id = auth.uid() AND current_level >= 4
    )
  );

CREATE POLICY "Users view their own webhook logs"
  ON public.webhook_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.webhook_subscriptions
      WHERE id = webhook_logs.subscription_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all webhook logs"
  ON public.webhook_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_authorization_levels
      WHERE user_id = auth.uid() AND current_level >= 4
    )
  );

-- 5. Trigger function: fires webhook-dispatch on status change
CREATE OR REPLACE FUNCTION public.notify_webhook_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/webhook-dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
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
END;
$$;

-- 6. Attach trigger to afroloc_records
CREATE TRIGGER trg_webhook_status_change
  AFTER UPDATE ON public.afroloc_records
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_webhook_on_status_change();

-- 7. Updated_at trigger for subscriptions
CREATE TRIGGER update_webhook_subscriptions_updated_at
  BEFORE UPDATE ON public.webhook_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
