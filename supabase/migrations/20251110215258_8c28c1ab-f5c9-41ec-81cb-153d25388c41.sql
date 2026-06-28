-- Create table for phone OTP verifications during signup/login
CREATE TABLE IF NOT EXISTS public.phone_otp_verifications (
  phone_number TEXT PRIMARY KEY,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.phone_otp_verifications ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage all OTP records
CREATE POLICY "Service role can manage OTP records"
  ON public.phone_otp_verifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_phone_otp_expires ON public.phone_otp_verifications(expires_at);
CREATE INDEX idx_phone_otp_verified ON public.phone_otp_verifications(verified);

-- Function to clean up expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_signup_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.phone_otp_verifications
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;