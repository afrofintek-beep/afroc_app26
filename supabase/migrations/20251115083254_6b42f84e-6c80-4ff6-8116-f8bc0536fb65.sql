-- Fix remaining security warning for determine_address_type function
CREATE OR REPLACE FUNCTION public.determine_address_type(
  p_street_name TEXT,
  p_number TEXT,
  p_street_code TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Address is formal if it has both street name and number
  -- Street code indicates it's part of official street registry
  IF p_street_name IS NOT NULL AND p_street_name != '' 
     AND p_number IS NOT NULL AND p_number != ''
     AND p_street_code IS NOT NULL AND p_street_code != '' THEN
    RETURN 'formal';
  ELSE
    RETURN 'digital';
  END IF;
END;
$$;