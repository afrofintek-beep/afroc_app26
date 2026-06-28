-- Create security events logging table
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  event_type TEXT NOT NULL, -- 'rate_limit', 'auth_failure', 'suspicious_activity', 'brute_force'
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  endpoint TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can view all security events"
  ON public.security_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update security events"
  ON public.security_events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX idx_security_events_created_at ON public.security_events(created_at DESC);
CREATE INDEX idx_security_events_event_type ON public.security_events(event_type);
CREATE INDEX idx_security_events_severity ON public.security_events(severity);
CREATE INDEX idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX idx_security_events_ip_address ON public.security_events(ip_address);
CREATE INDEX idx_security_events_resolved ON public.security_events(resolved);

-- Function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type TEXT,
  p_severity TEXT,
  p_user_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_endpoint TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.security_events (
    event_type,
    severity,
    user_id,
    ip_address,
    user_agent,
    endpoint,
    details
  ) VALUES (
    p_event_type,
    p_severity,
    p_user_id,
    p_ip_address,
    p_user_agent,
    p_endpoint,
    p_details
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Function to detect brute force attempts
CREATE OR REPLACE FUNCTION public.detect_brute_force_attempts()
RETURNS TABLE(
  ip_address TEXT,
  failed_attempts BIGINT,
  last_attempt TIMESTAMP WITH TIME ZONE,
  user_ids TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    se.ip_address,
    COUNT(*) as failed_attempts,
    MAX(se.created_at) as last_attempt,
    ARRAY_AGG(DISTINCT se.user_id::TEXT) FILTER (WHERE se.user_id IS NOT NULL) as user_ids
  FROM public.security_events se
  WHERE se.event_type = 'auth_failure'
    AND se.created_at > NOW() - INTERVAL '1 hour'
    AND se.ip_address IS NOT NULL
  GROUP BY se.ip_address
  HAVING COUNT(*) >= 5
  ORDER BY failed_attempts DESC;
END;
$$;

-- Function to get security event statistics
CREATE OR REPLACE FUNCTION public.get_security_stats(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '24 hours',
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE(
  event_type TEXT,
  severity TEXT,
  event_count BIGINT,
  unique_ips BIGINT,
  unique_users BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    se.event_type,
    se.severity,
    COUNT(*) as event_count,
    COUNT(DISTINCT se.ip_address) as unique_ips,
    COUNT(DISTINCT se.user_id) as unique_users
  FROM public.security_events se
  WHERE se.created_at >= p_start_date
    AND se.created_at <= p_end_date
  GROUP BY se.event_type, se.severity
  ORDER BY event_count DESC;
END;
$$;

-- Cleanup old security events (keep for 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_security_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.security_events
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND resolved = true;
END;
$$;