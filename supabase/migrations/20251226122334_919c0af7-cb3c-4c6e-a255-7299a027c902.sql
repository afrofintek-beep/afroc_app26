-- Update the validate_afroloc_code trigger to accept 7+ parts
-- Format with 7 parts: CC-MUN-COM-BAI-G10-X-Y (without province)
-- Format with 8 parts: CC-PROV-MUN-COM-BAI-G10-X-Y (with province)
-- Both formats are valid

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
  part_count INTEGER;
BEGIN
  -- Split the code by hyphens
  parts := string_to_array(NEW.code, '-');
  part_count := array_length(parts, 1);
  
  -- Must have at least 7 parts: CC-MUN-COM-BAI-G10-X-Y
  -- Or 8 parts for full format: CC-PROV-MUN-COM-BAI-G10-X-Y
  -- Or 6 parts for shorter: CC-MUN-COM-G10-X-Y
  -- Or 5 parts for legacy: CC-ZU-G10-X-Y
  IF part_count < 5 THEN
    RAISE EXCEPTION 'Invalid AFROLOC code format. Must have at least 5 parts. Got: % with % parts', NEW.code, part_count;
  END IF;
  
  v_country_code := parts[1];
  
  -- Validate country code (2 uppercase letters)
  IF v_country_code !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'Invalid country code: %. Must be 2 uppercase letters.', v_country_code;
  END IF;
  
  -- Determine format and extract province/municipality codes
  IF part_count >= 8 THEN
    -- Full format: CC-PROV-MUN-COM-BAI-G10-X-Y
    v_province_code := parts[2];
    v_municipality_code := parts[2] || '-' || parts[3];
  ELSIF part_count = 7 THEN
    -- Format without explicit province in code but may have it in level1_code
    -- CC-MUN-COM-BAI-G10-X-Y (MUN may be like "TAL" from province code)
    v_province_code := NEW.level1_code;
    v_municipality_code := parts[2];
  ELSIF part_count = 6 THEN
    -- Format without bairro: CC-MUN-COM-G10-X-Y
    v_province_code := NEW.level1_code;
    v_municipality_code := parts[2];
  ELSE
    -- Legacy format: CC-ZU-G10-X-Y (no admin validation)
    v_province_code := NEW.level1_code;
    v_municipality_code := NULL;
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
  
  -- Only validate against administrative_divisions if country requires it and we have admin codes
  IF country_requires_validation AND v_province_code IS NOT NULL THEN
    -- Check if country has any divisions configured
    SELECT EXISTS(
      SELECT 1 FROM administrative_divisions ad
      WHERE ad.country_code = NEW.country AND ad.level = 1
    ) INTO country_has_divisions;
    
    -- Only validate if country has divisions configured
    IF country_has_divisions THEN
      -- Validate province exists in administrative_divisions (if we have a province code)
      IF v_province_code IS NOT NULL THEN
        SELECT EXISTS(
          SELECT 1 FROM administrative_divisions ad
          WHERE ad.country_code = NEW.country 
          AND ad.code = v_province_code 
          AND ad.level = 1
        ) INTO valid_province;
        
        IF NOT valid_province THEN
          -- Province may be abbreviated, try partial match
          SELECT EXISTS(
            SELECT 1 FROM administrative_divisions ad
            WHERE ad.country_code = NEW.country 
            AND ad.level = 1
            AND (ad.code = v_province_code OR ad.code LIKE v_province_code || '%' OR v_province_code LIKE ad.code || '%')
          ) INTO valid_province;
          
          IF NOT valid_province THEN
            -- Log warning but don't block - province code may be abbreviated differently
            RAISE WARNING 'Province code % not found for country %. Proceeding with insert.', v_province_code, NEW.country;
          END IF;
        END IF;
      END IF;
      
      -- For municipality validation, be more lenient since codes may be abbreviated
      IF v_municipality_code IS NOT NULL AND part_count >= 8 THEN
        SELECT EXISTS(
          SELECT 1 FROM administrative_divisions ad
          WHERE ad.country_code = NEW.country 
          AND ad.code = v_municipality_code 
          AND ad.level = 2
        ) INTO valid_municipality;
        
        IF NOT valid_municipality THEN
          -- Municipality code may be abbreviated, just log warning
          RAISE WARNING 'Municipality code % not found for country %. Proceeding with insert.', v_municipality_code, NEW.country;
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;