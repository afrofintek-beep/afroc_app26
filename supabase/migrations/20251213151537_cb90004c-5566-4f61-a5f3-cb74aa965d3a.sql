
-- Update the determine_address_type function to support 3 types: formal, informal, digital
CREATE OR REPLACE FUNCTION public.determine_address_type(p_street_name text, p_number text, p_street_code text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Formal: has official street name, number AND street code
  IF p_street_name IS NOT NULL AND p_street_name != '' 
     AND p_number IS NOT NULL AND p_number != ''
     AND p_street_code IS NOT NULL AND p_street_code != '' THEN
    RETURN 'formal';
  -- Informal: has street name or number but NO official street code
  ELSIF (p_street_name IS NOT NULL AND p_street_name != '')
     OR (p_number IS NOT NULL AND p_number != '') THEN
    RETURN 'informal';
  -- Digital: only AFROLOC code (no street info)
  ELSE
    RETURN 'digital';
  END IF;
END;
$function$;

-- Add comment explaining the address types
COMMENT ON FUNCTION public.determine_address_type IS 'Determines address type: formal (official street+number+code), informal (street/number without official code), digital (AFROLOC only, no street info). All addresses receive an AFROLOC code as the unifying digital layer.';
