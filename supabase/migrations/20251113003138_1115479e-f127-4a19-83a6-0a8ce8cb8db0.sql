-- Add phone change tracking to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_phone_change_at TIMESTAMP WITH TIME ZONE;

-- Create index for phone change cooldown queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_phone_change 
ON public.profiles(user_id, last_phone_change_at);

-- Create table to track phone change attempts for rate limiting
CREATE TABLE IF NOT EXISTS public.phone_change_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('otp_request', 'otp_verify')),
  phone_number TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_phone_change_attempts_user_time
ON public.phone_change_attempts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phone_change_attempts_cleanup
ON public.phone_change_attempts(created_at);

-- Enable RLS on phone_change_attempts
ALTER TABLE public.phone_change_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view their own attempts
CREATE POLICY "Users can view their own phone change attempts"
ON public.phone_change_attempts
FOR SELECT
USING (auth.uid() = user_id);

-- Function to check if user can change phone (60 day cooldown)
CREATE OR REPLACE FUNCTION public.can_change_phone_number(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_change TIMESTAMP WITH TIME ZONE;
  v_cooldown_days INTEGER := 60;
BEGIN
  -- Get last phone change timestamp
  SELECT last_phone_change_at INTO v_last_change
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  -- If never changed, allow
  IF v_last_change IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Check if cooldown period has passed
  RETURN (NOW() - v_last_change) >= (v_cooldown_days || ' days')::INTERVAL;
END;
$$;

-- Function to get days remaining in cooldown
CREATE OR REPLACE FUNCTION public.get_phone_change_cooldown_days(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_change TIMESTAMP WITH TIME ZONE;
  v_cooldown_days INTEGER := 60;
  v_days_passed INTEGER;
BEGIN
  SELECT last_phone_change_at INTO v_last_change
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  IF v_last_change IS NULL THEN
    RETURN 0;
  END IF;
  
  v_days_passed := EXTRACT(DAY FROM (NOW() - v_last_change));
  
  IF v_days_passed >= v_cooldown_days THEN
    RETURN 0;
  END IF;
  
  RETURN v_cooldown_days - v_days_passed;
END;
$$;

-- Function to check rate limit for phone change attempts
CREATE OR REPLACE FUNCTION public.check_phone_change_rate_limit(
  p_user_id UUID,
  p_attempt_type TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_time_window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_count INTEGER;
BEGIN
  -- Count attempts within time window
  SELECT COUNT(*) INTO v_attempt_count
  FROM public.phone_change_attempts
  WHERE user_id = p_user_id
    AND attempt_type = p_attempt_type
    AND created_at > NOW() - (p_time_window_minutes || ' minutes')::INTERVAL;
  
  RETURN v_attempt_count < p_max_attempts;
END;
$$;

-- Function to log phone change attempt
CREATE OR REPLACE FUNCTION public.log_phone_change_attempt(
  p_user_id UUID,
  p_attempt_type TEXT,
  p_phone_number TEXT,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.phone_change_attempts (
    user_id,
    attempt_type,
    phone_number,
    ip_address
  ) VALUES (
    p_user_id,
    p_attempt_type,
    p_phone_number,
    p_ip_address
  );
END;
$$;

-- Cleanup function for old attempt records (keep 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_phone_change_attempts()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.phone_change_attempts
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;