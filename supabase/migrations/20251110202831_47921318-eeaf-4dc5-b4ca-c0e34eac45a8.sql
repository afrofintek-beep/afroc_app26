-- Create validation phone numbers table
CREATE TABLE public.validation_phone_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  country_code TEXT NOT NULL,
  administrative_division_id UUID NOT NULL,
  telecom_operator_id UUID,
  validator_user_id UUID,
  is_active BOOLEAN DEFAULT true,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'suspended')),
  allocated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (administrative_division_id) REFERENCES public.administrative_divisions(id) ON DELETE CASCADE,
  FOREIGN KEY (telecom_operator_id) REFERENCES public.telecom_operators(id) ON DELETE SET NULL,
  FOREIGN KEY (validator_user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX idx_validation_phones_division ON public.validation_phone_numbers(administrative_division_id);
CREATE INDEX idx_validation_phones_country ON public.validation_phone_numbers(country_code);
CREATE INDEX idx_validation_phones_active ON public.validation_phone_numbers(is_active, verification_status);
CREATE INDEX idx_validation_phones_validator ON public.validation_phone_numbers(validator_user_id);

-- Enable RLS
ALTER TABLE public.validation_phone_numbers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active validation numbers"
  ON public.validation_phone_numbers
  FOR SELECT
  USING (is_active = true AND verification_status = 'verified');

CREATE POLICY "Admins can manage validation numbers"
  ON public.validation_phone_numbers
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Validators can view their assigned numbers"
  ON public.validation_phone_numbers
  FOR SELECT
  USING (auth.uid() = validator_user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_validation_phone_numbers_updated_at
  BEFORE UPDATE ON public.validation_phone_numbers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get validation number for address
CREATE OR REPLACE FUNCTION public.get_validation_number_for_address(
  p_country_code TEXT,
  p_level1_code TEXT DEFAULT NULL,
  p_level2_code TEXT DEFAULT NULL,
  p_level3_code TEXT DEFAULT NULL,
  p_level4_code TEXT DEFAULT NULL
)
RETURNS TABLE (
  phone_number TEXT,
  division_name TEXT,
  division_level INTEGER,
  validator_user_id UUID
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_division_id UUID;
  v_division_level INTEGER;
BEGIN
  -- Try to find most specific division (level 4 -> 3 -> 2 -> 1)
  IF p_level4_code IS NOT NULL THEN
    SELECT id, 4 INTO v_division_id, v_division_level
    FROM administrative_divisions
    WHERE country_code = p_country_code
      AND level = 4
      AND code = p_level4_code
    LIMIT 1;
  END IF;

  IF v_division_id IS NULL AND p_level3_code IS NOT NULL THEN
    SELECT id, 3 INTO v_division_id, v_division_level
    FROM administrative_divisions
    WHERE country_code = p_country_code
      AND level = 3
      AND code = p_level3_code
    LIMIT 1;
  END IF;

  IF v_division_id IS NULL AND p_level2_code IS NOT NULL THEN
    SELECT id, 2 INTO v_division_id, v_division_level
    FROM administrative_divisions
    WHERE country_code = p_country_code
      AND level = 2
      AND code = p_level2_code
    LIMIT 1;
  END IF;

  IF v_division_id IS NULL AND p_level1_code IS NOT NULL THEN
    SELECT id, 1 INTO v_division_id, v_division_level
    FROM administrative_divisions
    WHERE country_code = p_country_code
      AND level = 1
      AND code = p_level1_code
    LIMIT 1;
  END IF;

  -- Return validation number for the division
  IF v_division_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      vpn.phone_number,
      ad.name,
      ad.level,
      vpn.validator_user_id
    FROM validation_phone_numbers vpn
    JOIN administrative_divisions ad ON ad.id = vpn.administrative_division_id
    WHERE vpn.administrative_division_id = v_division_id
      AND vpn.is_active = true
      AND vpn.verification_status = 'verified'
    ORDER BY vpn.usage_count ASC, vpn.last_used_at ASC NULLS FIRST
    LIMIT 1;
  END IF;

  RETURN;
END;
$$;

-- Function to update validation number usage
CREATE OR REPLACE FUNCTION public.update_validation_number_usage(
  p_phone_number TEXT
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE validation_phone_numbers
  SET 
    usage_count = usage_count + 1,
    last_used_at = now()
  WHERE phone_number = p_phone_number;
END;
$$;