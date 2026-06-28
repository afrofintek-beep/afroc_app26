-- Add attempts column to phone_otp_verifications table
ALTER TABLE public.phone_otp_verifications 
ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_phone_otp_attempts ON public.phone_otp_verifications(phone_number, attempts);