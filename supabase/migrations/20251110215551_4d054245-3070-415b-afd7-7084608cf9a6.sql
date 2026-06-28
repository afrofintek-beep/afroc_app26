-- Add telecom operator fields to phone_otp_verifications for network validation
ALTER TABLE public.phone_otp_verifications
ADD COLUMN IF NOT EXISTS operator_name TEXT,
ADD COLUMN IF NOT EXISTS operator_code TEXT,
ADD COLUMN IF NOT EXISTS country_code TEXT;

-- Create index for operator lookups
CREATE INDEX IF NOT EXISTS idx_phone_otp_operator ON public.phone_otp_verifications(operator_code, country_code);