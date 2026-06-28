-- Create table for biometric device tokens
CREATE TABLE IF NOT EXISTS public.biometric_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  device_token TEXT NOT NULL UNIQUE,
  device_name TEXT,
  device_type TEXT,
  device_fingerprint TEXT,
  browser TEXT,
  os TEXT,
  biometry_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '90 days')
);

-- Enable RLS
ALTER TABLE public.biometric_devices ENABLE ROW LEVEL SECURITY;

-- Users can view their own devices
CREATE POLICY "Users can view own biometric devices"
  ON public.biometric_devices
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can delete their own devices
CREATE POLICY "Users can delete own biometric devices"
  ON public.biometric_devices
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_biometric_devices_user_id ON public.biometric_devices(user_id);
CREATE INDEX idx_biometric_devices_phone ON public.biometric_devices(phone_number);
CREATE INDEX idx_biometric_devices_token ON public.biometric_devices(device_token);