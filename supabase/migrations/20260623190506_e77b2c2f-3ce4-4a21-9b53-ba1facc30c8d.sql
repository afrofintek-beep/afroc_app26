
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper: is current user admin lvl 4+
CREATE OR REPLACE FUNCTION public.podp_is_admin_lvl4()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_authorization_levels ual
    WHERE ual.user_id = auth.uid() AND ual.current_level >= 4
  );
$$;

-- =====================================================
-- 1) podp_config
-- =====================================================
CREATE TABLE public.podp_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'global',
  country_code TEXT,
  sample_interval_minutes INTEGER NOT NULL DEFAULT 15 CHECK (sample_interval_minutes BETWEEN 1 AND 240),
  tolerance_radius_urban_m INTEGER NOT NULL DEFAULT 75 CHECK (tolerance_radius_urban_m BETWEEN 10 AND 1000),
  tolerance_radius_rural_m INTEGER NOT NULL DEFAULT 250 CHECK (tolerance_radius_rural_m BETWEEN 25 AND 5000),
  min_hours_per_day NUMERIC(4,2) NOT NULL DEFAULT 6.0 CHECK (min_hours_per_day BETWEEN 0 AND 24),
  min_valid_days_ratio NUMERIC(4,3) NOT NULL DEFAULT 0.700 CHECK (min_valid_days_ratio BETWEEN 0 AND 1),
  cycle_length_days INTEGER NOT NULL DEFAULT 14 CHECK (cycle_length_days BETWEEN 1 AND 365),
  max_gps_accuracy_m INTEGER NOT NULL DEFAULT 100 CHECK (max_gps_accuracy_m BETWEEN 5 AND 1000),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope, country_code)
);

GRANT SELECT ON public.podp_config TO authenticated;
GRANT ALL ON public.podp_config TO service_role;
ALTER TABLE public.podp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "podp_config select all auth"
  ON public.podp_config FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "podp_config write admin lvl4"
  ON public.podp_config FOR ALL TO authenticated
  USING (public.podp_is_admin_lvl4())
  WITH CHECK (public.podp_is_admin_lvl4());

-- =====================================================
-- 2) podp_samples
-- =====================================================
CREATE TABLE public.podp_samples (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  afroloc_record_id UUID NOT NULL REFERENCES public.afroloc_records(id) ON DELETE CASCADE,
  geo_lat DOUBLE PRECISION NOT NULL,
  geo_lon DOUBLE PRECISION NOT NULL,
  accuracy_m NUMERIC(8,2),
  distance_from_address_m NUMERIC(10,2) NOT NULL,
  is_within_radius BOOLEAN NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_fingerprint TEXT,
  client_generated_id TEXT NOT NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_generated_id)
);
CREATE INDEX idx_podp_samples_user_captured ON public.podp_samples (user_id, captured_at DESC);
CREATE INDEX idx_podp_samples_record_captured ON public.podp_samples (afroloc_record_id, captured_at DESC);
CREATE INDEX idx_podp_samples_received ON public.podp_samples (received_at);

GRANT SELECT ON public.podp_samples TO authenticated;
GRANT ALL ON public.podp_samples TO service_role;
ALTER TABLE public.podp_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "podp_samples select admin lvl4"
  ON public.podp_samples FOR SELECT TO authenticated
  USING (public.podp_is_admin_lvl4());

-- =====================================================
-- 3) podp_daily_rollup
-- =====================================================
CREATE TABLE public.podp_daily_rollup (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  afroloc_record_id UUID NOT NULL REFERENCES public.afroloc_records(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  valid_samples INTEGER NOT NULL DEFAULT 0,
  hours_present NUMERIC(6,2) NOT NULL DEFAULT 0,
  day_is_valid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (afroloc_record_id, day)
);
CREATE INDEX idx_podp_daily_record_day ON public.podp_daily_rollup (afroloc_record_id, day DESC);
CREATE INDEX idx_podp_daily_user_day ON public.podp_daily_rollup (user_id, day DESC);

GRANT SELECT ON public.podp_daily_rollup TO authenticated;
GRANT ALL ON public.podp_daily_rollup TO service_role;
ALTER TABLE public.podp_daily_rollup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "podp_daily select admin lvl4"
  ON public.podp_daily_rollup FOR SELECT TO authenticated
  USING (public.podp_is_admin_lvl4());

-- =====================================================
-- 4) podp_cycles
-- =====================================================
CREATE TABLE public.podp_cycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  afroloc_record_id UUID NOT NULL REFERENCES public.afroloc_records(id) ON DELETE CASCADE,
  cycle_start DATE NOT NULL,
  cycle_end DATE NOT NULL,
  valid_days INTEGER NOT NULL DEFAULT 0,
  total_days INTEGER NOT NULL,
  podp_score INTEGER NOT NULL DEFAULT 0 CHECK (podp_score BETWEEN 0 AND 100),
  applied_to_ats BOOLEAN NOT NULL DEFAULT FALSE,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (afroloc_record_id, cycle_start, cycle_end)
);
CREATE INDEX idx_podp_cycles_record ON public.podp_cycles (afroloc_record_id, cycle_end DESC);
CREATE INDEX idx_podp_cycles_user ON public.podp_cycles (user_id, cycle_end DESC);

GRANT SELECT ON public.podp_cycles TO authenticated;
GRANT ALL ON public.podp_cycles TO service_role;
ALTER TABLE public.podp_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "podp_cycles select admin lvl4"
  ON public.podp_cycles FOR SELECT TO authenticated
  USING (public.podp_is_admin_lvl4());

-- =====================================================
-- 5) updated_at trigger
-- =====================================================
CREATE OR REPLACE FUNCTION public.podp_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_podp_config_updated BEFORE UPDATE ON public.podp_config
  FOR EACH ROW EXECUTE FUNCTION public.podp_set_updated_at();
CREATE TRIGGER trg_podp_daily_updated BEFORE UPDATE ON public.podp_daily_rollup
  FOR EACH ROW EXECUTE FUNCTION public.podp_set_updated_at();

-- =====================================================
-- 6) Default global config
-- =====================================================
INSERT INTO public.podp_config (scope, country_code) VALUES ('global', NULL)
ON CONFLICT (scope, country_code) DO NOTHING;
