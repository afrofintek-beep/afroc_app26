
-- Fix ambiguous column reference in validate_afroloc_code function
CREATE OR REPLACE FUNCTION public.validate_afroloc_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parts TEXT[];
  v_country_code TEXT;
  v_province_code TEXT;
  v_municipality_code TEXT;
  valid_province BOOLEAN;
  valid_municipality BOOLEAN;
BEGIN
  -- Split the code by hyphens
  parts := string_to_array(NEW.code, '-');
  
  -- Must have at least 8 parts: CC-PROV-MUN-COM-BAI-G10-X-Y
  IF array_length(parts, 1) < 8 THEN
    RAISE EXCEPTION 'Invalid AFROLOC code format. Must be: CC-PROV-MUN-COM-BAI-G10-X-Y. Got: %', NEW.code;
  END IF;
  
  v_country_code := parts[1];
  v_province_code := parts[2];
  v_municipality_code := parts[2] || '-' || parts[3];
  
  -- Validate country code (2 uppercase letters)
  IF v_country_code !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'Invalid country code: %. Must be 2 uppercase letters.', v_country_code;
  END IF;
  
  -- Validate province exists in administrative_divisions
  SELECT EXISTS(
    SELECT 1 FROM administrative_divisions ad
    WHERE ad.country_code = NEW.country 
    AND ad.code = v_province_code 
    AND ad.level = 1
  ) INTO valid_province;
  
  IF NOT valid_province THEN
    RAISE EXCEPTION 'Invalid province code: %. Must match an existing administrative division.', v_province_code;
  END IF;
  
  -- Validate municipality exists in administrative_divisions
  SELECT EXISTS(
    SELECT 1 FROM administrative_divisions ad
    WHERE ad.country_code = NEW.country 
    AND ad.code = v_municipality_code 
    AND ad.level = 2
  ) INTO valid_municipality;
  
  IF NOT valid_municipality THEN
    RAISE EXCEPTION 'Invalid municipality code: %. Must match an existing administrative division.', v_municipality_code;
  END IF;
  
  -- Validate level1_code matches the province in the AFROLOC code
  IF NEW.level1_code IS NOT NULL AND NEW.level1_code != v_province_code THEN
    RAISE EXCEPTION 'level1_code (%) does not match province in AFROLOC code (%).', NEW.level1_code, v_province_code;
  END IF;
  
  -- Auto-set level1_code if not provided
  IF NEW.level1_code IS NULL THEN
    NEW.level1_code := v_province_code;
  END IF;
  
  RETURN NEW;
END;
$$;
