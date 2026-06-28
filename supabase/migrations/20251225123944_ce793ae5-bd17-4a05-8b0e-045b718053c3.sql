
-- Add flag to countries table to control division validation
ALTER TABLE countries 
ADD COLUMN IF NOT EXISTS requires_division_validation BOOLEAN DEFAULT true;

-- Add comment explaining the field
COMMENT ON COLUMN countries.requires_division_validation IS 'When true, AFROLOC codes must match existing administrative_divisions. When false, codes are accepted without validation.';

-- Set Angola to require validation (already has divisions)
UPDATE countries SET requires_division_validation = true WHERE country_code = 'AO';

-- Set other countries to NOT require validation until their divisions are imported
UPDATE countries SET requires_division_validation = false WHERE country_code != 'AO';

-- Update the validation trigger to check the flag
CREATE OR REPLACE FUNCTION validate_afroloc_code()
RETURNS TRIGGER AS $$
DECLARE
  parts TEXT[];
  v_country_code TEXT;
  v_province_code TEXT;
  v_municipality_code TEXT;
  valid_province BOOLEAN;
  valid_municipality BOOLEAN;
  country_requires_validation BOOLEAN;
  country_has_divisions BOOLEAN;
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
  
  -- Check if country requires division validation
  SELECT COALESCE(requires_division_validation, false)
  INTO country_requires_validation
  FROM countries
  WHERE country_code = NEW.country;
  
  -- If country not found in countries table, default to no validation
  IF NOT FOUND THEN
    country_requires_validation := false;
  END IF;
  
  -- Only validate against administrative_divisions if country requires it
  IF country_requires_validation THEN
    -- Check if country has any divisions configured
    SELECT EXISTS(
      SELECT 1 FROM administrative_divisions ad
      WHERE ad.country_code = NEW.country AND ad.level = 1
    ) INTO country_has_divisions;
    
    -- Only validate if country has divisions configured
    IF country_has_divisions THEN
      -- Validate province exists in administrative_divisions
      SELECT EXISTS(
        SELECT 1 FROM administrative_divisions ad
        WHERE ad.country_code = NEW.country 
        AND ad.code = v_province_code 
        AND ad.level = 1
      ) INTO valid_province;
      
      IF NOT valid_province THEN
        RAISE EXCEPTION 'Invalid province code: %. Must match an existing administrative division for %.', v_province_code, NEW.country;
      END IF;
      
      -- Validate municipality exists in administrative_divisions
      SELECT EXISTS(
        SELECT 1 FROM administrative_divisions ad
        WHERE ad.country_code = NEW.country 
        AND ad.code = v_municipality_code 
        AND ad.level = 2
      ) INTO valid_municipality;
      
      IF NOT valid_municipality THEN
        RAISE EXCEPTION 'Invalid municipality code: %. Must match an existing administrative division for %.', v_municipality_code, NEW.country;
      END IF;
      
      -- Validate level1_code matches the province in the AFROLOC code
      IF NEW.level1_code IS NOT NULL AND NEW.level1_code != v_province_code THEN
        RAISE EXCEPTION 'level1_code (%) does not match province in AFROLOC code (%).', NEW.level1_code, v_province_code;
      END IF;
      
      -- Auto-set level1_code if not provided
      IF NEW.level1_code IS NULL THEN
        NEW.level1_code := v_province_code;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
