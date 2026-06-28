-- Add OTP fields to afroid_witnesses table
ALTER TABLE public.afroid_witnesses
ADD COLUMN otp_code TEXT,
ADD COLUMN otp_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN otp_sent_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster OTP lookups
CREATE INDEX idx_afroid_witnesses_otp ON public.afroid_witnesses(otp_code) WHERE otp_code IS NOT NULL;