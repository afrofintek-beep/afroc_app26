-- Create table for 2FA codes
CREATE TABLE public.two_factor_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('email', 'sms')),
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT
);

ALTER TABLE public.two_factor_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own 2FA codes"
  ON public.two_factor_codes FOR SELECT
  USING (auth.uid() = user_id);

-- Add 2FA preference to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_method TEXT DEFAULT 'email' CHECK (two_factor_method IN ('email', 'sms'));

-- Create index for faster lookups
CREATE INDEX idx_two_factor_codes_user_id ON public.two_factor_codes(user_id);
CREATE INDEX idx_two_factor_codes_expires_at ON public.two_factor_codes(expires_at);

-- Function to clean up expired 2FA codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_2fa_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.two_factor_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;