
-- =============================================
-- AFROLOC CHECK-IN SYSTEM: Proof of Presence
-- =============================================

-- 1. Checkins table
CREATE TABLE public.afroloc_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  afroloc_record_id UUID NOT NULL REFERENCES public.afroloc_records(id) ON DELETE CASCADE,
  geo_lat DOUBLE PRECISION NOT NULL,
  geo_lon DOUBLE PRECISION NOT NULL,
  accuracy_meters DOUBLE PRECISION,
  device_fingerprint TEXT,
  device_info JSONB,
  distance_from_address_meters DOUBLE PRECISION,
  is_valid BOOLEAN DEFAULT true,
  rejection_reason TEXT,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cooldown_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add checkin tracking to afroloc_records
ALTER TABLE public.afroloc_records
  ADD COLUMN IF NOT EXISTS next_checkin_due TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_checkin_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkin_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missed_checkins INTEGER DEFAULT 0;

-- 3. Indexes
CREATE INDEX idx_checkins_user ON public.afroloc_checkins(user_id);
CREATE INDEX idx_checkins_record ON public.afroloc_checkins(afroloc_record_id);
CREATE INDEX idx_checkins_timestamp ON public.afroloc_checkins(checked_in_at DESC);
CREATE INDEX idx_records_next_checkin ON public.afroloc_records(next_checkin_due) WHERE next_checkin_due IS NOT NULL;

-- 4. RLS
ALTER TABLE public.afroloc_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own checkins"
  ON public.afroloc_checkins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own checkins"
  ON public.afroloc_checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all checkins"
  ON public.afroloc_checkins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_authorization_levels
      WHERE user_id = auth.uid() AND current_level >= 4
    )
  );

-- 5. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.afroloc_checkins;
