-- Update the telecom operator detection function to handle country codes
CREATE OR REPLACE FUNCTION public.get_telecom_operator_by_phone(phone_number text)
 RETURNS TABLE(operator_id uuid, operator_name text, operator_code text, otp_provider text, country_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cleaned_phone text;
BEGIN
  -- Remove + and spaces from phone number for matching
  cleaned_phone := regexp_replace(phone_number, '[^0-9]', '', 'g');
  
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
      WHERE cleaned_phone LIKE (
        CASE 
          -- For Angola (+244), prefixes should match after country code
          WHEN t.country_code = 'AO' THEN '244' || prefix || '%'
          -- Add other country codes as needed
          ELSE prefix || '%'
        END
      )
    )
  ORDER BY array_length(t.phone_prefixes, 1) DESC
  LIMIT 1;
END;
$function$;