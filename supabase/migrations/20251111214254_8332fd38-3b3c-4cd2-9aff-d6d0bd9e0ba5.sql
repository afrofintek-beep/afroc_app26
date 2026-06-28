-- Create table for biometric login history
CREATE TABLE IF NOT EXISTS public.biometric_login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  browser TEXT,
  os TEXT,
  ip_address INET,
  biometry_type TEXT NOT NULL,
  login_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_biometric_login_history_user_id ON public.biometric_login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_biometric_login_history_login_at ON public.biometric_login_history(login_at DESC);

-- Enable RLS
ALTER TABLE public.biometric_login_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own login history
CREATE POLICY "Users can view their own biometric login history"
  ON public.biometric_login_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own login records (via authenticated calls)
CREATE POLICY "Users can insert their own biometric login history"
  ON public.biometric_login_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.biometric_login_history IS 'Tracks biometric authentication login history for security auditing';