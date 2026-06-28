-- Create table for backup codes
CREATE TABLE public.two_factor_backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL UNIQUE,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

ALTER TABLE public.two_factor_backup_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own backup codes"
  ON public.two_factor_backup_codes FOR SELECT
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_backup_codes_user_id ON public.two_factor_backup_codes(user_id);
CREATE INDEX idx_backup_codes_code ON public.two_factor_backup_codes(code) WHERE NOT used;

-- Function to count remaining backup codes
CREATE OR REPLACE FUNCTION public.count_unused_backup_codes(_user_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.two_factor_backup_codes
  WHERE user_id = _user_id AND NOT used;
$$;