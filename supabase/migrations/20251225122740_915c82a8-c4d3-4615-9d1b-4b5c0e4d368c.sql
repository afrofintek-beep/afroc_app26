
-- Create function to validate AFROLOC code format
CREATE OR REPLACE FUNCTION public.validate_afroloc_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parts TEXT[];
  country_code TEXT;
  province_code TEXT;
  municipality_code TEXT;
  valid_province BOOLEAN;
  valid_municipality BOOLEAN;
BEGIN
  -- Split the code by hyphens
  parts := string_to_array(NEW.code, '-');
  
  -- Must have at least 8 parts: CC-PROV-MUN-COM-BAI-G10-X-Y
  IF array_length(parts, 1) < 8 THEN
    RAISE EXCEPTION 'Invalid AFROLOC code format. Must be: CC-PROV-MUN-COM-BAI-G10-X-Y. Got: %', NEW.code;
  END IF;
  
  country_code := parts[1];
  province_code := parts[2];
  municipality_code := parts[2] || '-' || parts[3];
  
  -- Validate country code (2 uppercase letters)
  IF country_code !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'Invalid country code: %. Must be 2 uppercase letters.', country_code;
  END IF;
  
  -- Validate province exists in administrative_divisions
  SELECT EXISTS(
    SELECT 1 FROM administrative_divisions 
    WHERE country_code = NEW.country 
    AND code = province_code 
    AND level = 1
  ) INTO valid_province;
  
  IF NOT valid_province THEN
    RAISE EXCEPTION 'Invalid province code: %. Must match an existing administrative division.', province_code;
  END IF;
  
  -- Validate municipality exists in administrative_divisions
  SELECT EXISTS(
    SELECT 1 FROM administrative_divisions 
    WHERE country_code = NEW.country 
    AND code = municipality_code 
    AND level = 2
  ) INTO valid_municipality;
  
  IF NOT valid_municipality THEN
    RAISE EXCEPTION 'Invalid municipality code: %. Must match an existing administrative division.', municipality_code;
  END IF;
  
  -- Validate level1_code matches the province in the AFROLOC code
  IF NEW.level1_code IS NOT NULL AND NEW.level1_code != province_code THEN
    RAISE EXCEPTION 'level1_code (%) does not match province in AFROLOC code (%).', NEW.level1_code, province_code;
  END IF;
  
  -- Auto-set level1_code if not provided
  IF NEW.level1_code IS NULL THEN
    NEW.level1_code := province_code;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to validate on insert and update
DROP TRIGGER IF EXISTS validate_afroloc_code_trigger ON afroloc_records;
CREATE TRIGGER validate_afroloc_code_trigger
  BEFORE INSERT OR UPDATE OF code ON afroloc_records
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_afroloc_code();

-- Add comment explaining the validation
COMMENT ON FUNCTION public.validate_afroloc_code() IS 
'Validates AFROLOC code format: CC-PROV-MUN-COM-BAI-G10-X-Y. 
Ensures province and municipality codes match administrative_divisions table.';
