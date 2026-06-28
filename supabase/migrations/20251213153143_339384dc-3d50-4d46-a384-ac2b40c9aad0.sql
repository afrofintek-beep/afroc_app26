-- Update determine_address_type function to use 2 types: formal and digital
CREATE OR REPLACE FUNCTION public.determine_address_type(p_street_name text, p_number text, p_street_code text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Formal: has street name AND number (complete traditional address)
  IF p_street_name IS NOT NULL AND p_street_name != '' 
     AND p_number IS NOT NULL AND p_number != '' THEN
    RETURN 'formal';
  -- Digital: needs AFROLOC identification (no complete formal address)
  ELSE
    RETURN 'digital';
  END IF;
END;
$function$;

-- Update constraint to only allow 2 types
ALTER TABLE afroloc_records DROP CONSTRAINT IF EXISTS afroloc_records_address_type_check;
ALTER TABLE afroloc_records ADD CONSTRAINT afroloc_records_address_type_check 
  CHECK (address_type IN ('formal', 'digital'));