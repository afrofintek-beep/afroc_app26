-- Create risk alert settings table
CREATE TABLE IF NOT EXISTS public.risk_alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('email', 'sms', 'both')),
  high_risk_threshold INTEGER NOT NULL DEFAULT 75,
  critical_risk_threshold INTEGER NOT NULL DEFAULT 85,
  trend_increase_threshold INTEGER NOT NULL DEFAULT 15,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create risk alerts log table
CREATE TABLE IF NOT EXISTS public.risk_alerts_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  risk_score INTEGER NOT NULL,
  region_name TEXT,
  country_code TEXT,
  message TEXT NOT NULL,
  sent_via TEXT NOT NULL CHECK (sent_via IN ('email', 'sms', 'both')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.risk_alert_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_alerts_log ENABLE ROW LEVEL SECURITY;

-- Policies for risk_alert_settings
CREATE POLICY "Users can view their own alert settings"
  ON public.risk_alert_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own alert settings"
  ON public.risk_alert_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all alert settings"
  ON public.risk_alert_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies for risk_alerts_log
CREATE POLICY "Users can view their own alerts log"
  ON public.risk_alerts_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all alerts log"
  ON public.risk_alerts_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert alerts"
  ON public.risk_alerts_log FOR INSERT
  WITH CHECK (true);

-- Function to check and send risk alerts
CREATE OR REPLACE FUNCTION public.check_risk_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_record RECORD;
  v_risk_score INTEGER;
BEGIN
  -- Check each address record for risk levels
  FOR v_record IN 
    SELECT 
      ar.*,
      p.user_id,
      p.phone,
      p.full_name,
      ras.high_risk_threshold,
      ras.critical_risk_threshold,
      ras.alert_type,
      ras.enabled
    FROM afroid_records ar
    JOIN profiles p ON p.user_id = ar.user_id
    LEFT JOIN risk_alert_settings ras ON ras.user_id = p.user_id
    WHERE ras.enabled IS TRUE OR ras.enabled IS NULL
  LOOP
    -- Calculate risk score (simplified version)
    v_risk_score := CASE
      WHEN v_record.next_verification_due < NOW() THEN 90
      WHEN v_record.next_verification_due < NOW() + INTERVAL '7 days' THEN 80
      WHEN v_record.street_name IS NULL OR v_record.number IS NULL THEN 70
      ELSE 30
    END;
    
    -- Send alert if threshold exceeded
    IF v_risk_score >= COALESCE(v_record.critical_risk_threshold, 85) THEN
      -- Log critical alert
      INSERT INTO risk_alerts_log (
        user_id, alert_type, risk_score, region_name, country_code, message, sent_via, metadata
      ) VALUES (
        v_record.user_id,
        'critical_risk',
        v_risk_score,
        v_record.level1_name,
        v_record.country,
        'Alerta Crítico: Score de risco ' || v_risk_score || ' para endereço ' || v_record.code,
        COALESCE(v_record.alert_type, 'email'),
        jsonb_build_object('afroid_code', v_record.code, 'threshold', 'critical')
      );
    ELSIF v_risk_score >= COALESCE(v_record.high_risk_threshold, 75) THEN
      -- Log high risk alert
      INSERT INTO risk_alerts_log (
        user_id, alert_type, risk_score, region_name, country_code, message, sent_via, metadata
      ) VALUES (
        v_record.user_id,
        'high_risk',
        v_risk_score,
        v_record.level1_name,
        v_record.country,
        'Alerta: Score de risco ' || v_risk_score || ' para endereço ' || v_record.code,
        COALESCE(v_record.alert_type, 'email'),
        jsonb_build_object('afroid_code', v_record.code, 'threshold', 'high')
      );
    END IF;
  END LOOP;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_risk_alert_settings_updated_at
  BEFORE UPDATE ON public.risk_alert_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();