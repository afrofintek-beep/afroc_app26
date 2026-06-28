-- Create telecom operators table
CREATE TABLE public.telecom_operators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  operator_code TEXT NOT NULL,
  phone_prefixes TEXT[] NOT NULL,
  otp_provider TEXT NOT NULL CHECK (otp_provider IN ('twilio', 'other')),
  administrative_division_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (administrative_division_id) REFERENCES public.administrative_divisions(id) ON DELETE SET NULL,
  UNIQUE(country_code, operator_code)
);

-- Create index for faster phone number lookups
CREATE INDEX idx_telecom_operators_country ON public.telecom_operators(country_code);
CREATE INDEX idx_telecom_operators_prefixes ON public.telecom_operators USING GIN(phone_prefixes);
CREATE INDEX idx_telecom_operators_division ON public.telecom_operators(administrative_division_id);

-- Enable RLS
ALTER TABLE public.telecom_operators ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active telecom operators"
  ON public.telecom_operators
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage telecom operators"
  ON public.telecom_operators
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_telecom_operators_updated_at
  BEFORE UPDATE ON public.telecom_operators
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to find telecom operator by phone number
CREATE OR REPLACE FUNCTION public.get_telecom_operator_by_phone(
  phone_number TEXT
)
RETURNS TABLE (
  operator_id UUID,
  operator_name TEXT,
  operator_code TEXT,
  otp_provider TEXT,
  country_code TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.operator_name,
    t.operator_code,
    t.otp_provider,
    t.country_code
  FROM public.telecom_operators t
  WHERE t.is_active = true
    AND EXISTS (
      SELECT 1
      FROM unnest(t.phone_prefixes) AS prefix
      WHERE phone_number LIKE prefix || '%'
    )
  ORDER BY array_length(t.phone_prefixes, 1) DESC
  LIMIT 1;
END;
$$;