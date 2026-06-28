-- Create enum for delivery point types
CREATE TYPE public.delivery_point_type AS ENUM ('po_box', 'locker', 'pickup');

-- Create enum for delivery point status
CREATE TYPE public.delivery_point_status AS ENUM ('pending_otp', 'active', 'revoked', 'expired');

-- Table: afroloc_operators (delivery service operators)
CREATE TABLE public.afroloc_operators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    operator_type TEXT NOT NULL DEFAULT 'postal',
    logo_path TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    api_endpoint TEXT,
    api_key_encrypted TEXT,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on operators
ALTER TABLE public.afroloc_operators ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone can view active operators
CREATE POLICY "Anyone can view active operators"
ON public.afroloc_operators
FOR SELECT
USING (is_active = true);

-- RLS: Admins can manage operators
CREATE POLICY "Admins can manage operators"
ON public.afroloc_operators
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Table: afroloc_delivery_points (user's delivery channels)
CREATE TABLE public.afroloc_delivery_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    afroloc_record_id UUID NOT NULL REFERENCES public.afroloc_records(id) ON DELETE CASCADE,
    operator_id UUID NOT NULL REFERENCES public.afroloc_operators(id),
    point_type delivery_point_type NOT NULL,
    point_code TEXT NOT NULL,
    point_name TEXT,
    point_address TEXT,
    geo_lat NUMERIC,
    geo_lon NUMERIC,
    is_primary BOOLEAN DEFAULT false,
    status delivery_point_status DEFAULT 'pending_otp',
    otp_code TEXT,
    otp_expires_at TIMESTAMPTZ,
    otp_attempts INTEGER DEFAULT 0,
    confirmed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, afroloc_record_id, operator_id, point_code)
);

-- Enable RLS on delivery points
ALTER TABLE public.afroloc_delivery_points ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own delivery points (hide OTP code)
CREATE POLICY "Users can view their own delivery points"
ON public.afroloc_delivery_points
FOR SELECT
USING (auth.uid() = user_id AND otp_code IS NULL);

-- RLS: Users can insert their own delivery points
CREATE POLICY "Users can insert their own delivery points"
ON public.afroloc_delivery_points
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS: Users can update their own delivery points
CREATE POLICY "Users can update their own delivery points"
ON public.afroloc_delivery_points
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS: Admins can manage all delivery points
CREATE POLICY "Admins can manage all delivery points"
ON public.afroloc_delivery_points
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Table: afroloc_delivery_audit_log
CREATE TABLE public.afroloc_delivery_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_point_id UUID REFERENCES public.afroloc_delivery_points(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.afroloc_delivery_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own audit logs
CREATE POLICY "Users can view their own delivery audit logs"
ON public.afroloc_delivery_audit_log
FOR SELECT
USING (auth.uid() = user_id);

-- RLS: System can insert audit logs
CREATE POLICY "System can insert delivery audit logs"
ON public.afroloc_delivery_audit_log
FOR INSERT
WITH CHECK (true);

-- RLS: Admins can view all audit logs
CREATE POLICY "Admins can view all delivery audit logs"
ON public.afroloc_delivery_audit_log
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_delivery_points_user_id ON public.afroloc_delivery_points(user_id);
CREATE INDEX idx_delivery_points_afroloc_record_id ON public.afroloc_delivery_points(afroloc_record_id);
CREATE INDEX idx_delivery_points_status ON public.afroloc_delivery_points(status);
CREATE INDEX idx_delivery_points_is_primary ON public.afroloc_delivery_points(is_primary) WHERE is_primary = true;
CREATE INDEX idx_delivery_audit_log_user_id ON public.afroloc_delivery_audit_log(user_id);
CREATE INDEX idx_delivery_audit_log_delivery_point_id ON public.afroloc_delivery_audit_log(delivery_point_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_delivery_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_afroloc_delivery_points_updated_at
    BEFORE UPDATE ON public.afroloc_delivery_points
    FOR EACH ROW
    EXECUTE FUNCTION public.update_delivery_points_updated_at();

CREATE TRIGGER update_afroloc_operators_updated_at
    BEFORE UPDATE ON public.afroloc_operators
    FOR EACH ROW
    EXECUTE FUNCTION public.update_delivery_points_updated_at();

-- Insert some default operators for Angola
INSERT INTO public.afroloc_operators (code, name, country_code, operator_type, is_active) VALUES
('CORREIOS_AO', 'Correios de Angola', 'AO', 'postal', true),
('DHL_AO', 'DHL Angola', 'AO', 'courier', true),
('FEDEX_AO', 'FedEx Angola', 'AO', 'courier', true),
('PICKUP_LOCKER', 'AFROLOC Lockers', 'AO', 'locker', true);