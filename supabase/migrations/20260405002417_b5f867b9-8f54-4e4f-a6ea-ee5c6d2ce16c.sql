
-- Table for partner API keys
CREATE TABLE public.partner_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE DEFAULT 'ak_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  api_key_hash TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  permissions TEXT[] NOT NULL DEFAULT ARRAY['read'],
  description TEXT,
  last_used_at TIMESTAMPTZ,
  request_count BIGINT NOT NULL DEFAULT 0,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_api_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can manage API keys
CREATE POLICY "Admins can view API keys"
  ON public.partner_api_keys FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create API keys"
  ON public.partner_api_keys FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update API keys"
  ON public.partner_api_keys FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete API keys"
  ON public.partner_api_keys FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Function to auto-hash the API key on insert/update
CREATE OR REPLACE FUNCTION public.hash_partner_api_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.api_key_hash = '' OR NEW.api_key_hash IS NULL THEN
    NEW.api_key_hash := encode(digest(NEW.api_key, 'sha256'), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hash_partner_api_key
  BEFORE INSERT OR UPDATE ON public.partner_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.hash_partner_api_key();

-- Index for fast key lookup by hash
CREATE INDEX idx_partner_api_keys_hash ON public.partner_api_keys (api_key_hash) WHERE is_active = true;

-- Audit log for API usage
CREATE TABLE public.partner_api_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES public.partner_api_keys(id) ON DELETE SET NULL,
  partner_name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  request_body JSONB,
  response_summary TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_api_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view logs
CREATE POLICY "Admins can view API logs"
  ON public.partner_api_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role can insert logs
CREATE POLICY "Service role inserts API logs"
  ON public.partner_api_log FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Allow service_role to bypass RLS (edge functions use service role)
ALTER TABLE public.partner_api_log FORCE ROW LEVEL SECURITY;

-- Index for querying logs by partner
CREATE INDEX idx_partner_api_log_key ON public.partner_api_log (api_key_id, created_at DESC);
CREATE INDEX idx_partner_api_log_time ON public.partner_api_log (created_at DESC);
