-- 1. Table for tracking user devices and sessions
CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL, -- 'mobile', 'desktop', 'tablet'
  device_fingerprint TEXT NOT NULL,
  browser TEXT,
  os TEXT,
  ip_address INET,
  user_agent TEXT,
  is_trusted BOOLEAN DEFAULT FALSE,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, device_fingerprint)
);

-- Enable RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Users can view their own devices
CREATE POLICY "Users can view their own devices"
  ON public.user_devices
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own devices
CREATE POLICY "Users can insert their own devices"
  ON public.user_devices
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own devices
CREATE POLICY "Users can update their own devices"
  ON public.user_devices
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own devices
CREATE POLICY "Users can delete their own devices"
  ON public.user_devices
  FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Table for 2FA settings (extending existing)
CREATE TABLE IF NOT EXISTS public.user_2fa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT FALSE,
  method TEXT DEFAULT 'sms', -- 'sms', 'email', 'authenticator'
  phone_verified BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  authenticator_secret TEXT,
  backup_codes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_2fa_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own 2FA settings
CREATE POLICY "Users can view their own 2FA settings"
  ON public.user_2fa_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can manage their own 2FA settings
CREATE POLICY "Users can manage their own 2FA settings"
  ON public.user_2fa_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Table for offline data cache metadata
CREATE TABLE IF NOT EXISTS public.offline_cache_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL,
  data_type TEXT NOT NULL, -- 'profile', 'identities', 'documents'
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  checksum TEXT,
  UNIQUE(user_id, cache_key)
);

-- Enable RLS
ALTER TABLE public.offline_cache_metadata ENABLE ROW LEVEL SECURITY;

-- Users can manage their own cache metadata
CREATE POLICY "Users can manage their own cache"
  ON public.offline_cache_metadata
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX idx_user_devices_last_active ON public.user_devices(last_active_at DESC);
CREATE INDEX idx_user_devices_fingerprint ON public.user_devices(device_fingerprint);
CREATE INDEX idx_user_2fa_user_id ON public.user_2fa_settings(user_id);
CREATE INDEX idx_offline_cache_user_id ON public.offline_cache_metadata(user_id);
CREATE INDEX idx_offline_cache_expires ON public.offline_cache_metadata(expires_at);

-- Function to update device last active
CREATE OR REPLACE FUNCTION public.update_device_activity(
  p_user_id UUID,
  p_device_fingerprint TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_devices
  SET last_active_at = NOW()
  WHERE user_id = p_user_id 
    AND device_fingerprint = p_device_fingerprint
    AND revoked_at IS NULL;
END;
$$;

-- Function to cleanup old sessions
CREATE OR REPLACE FUNCTION public.cleanup_old_sessions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark devices inactive after 90 days
  UPDATE public.user_devices
  SET revoked_at = NOW()
  WHERE last_active_at < NOW() - INTERVAL '90 days'
    AND revoked_at IS NULL;
  
  -- Delete very old cache metadata
  DELETE FROM public.offline_cache_metadata
  WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$;