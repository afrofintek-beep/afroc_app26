-- Fix telecom operator detection to be more precise and prioritize country-specific matches
CREATE OR REPLACE FUNCTION public.get_telecom_operator_by_phone(phone_number text)
 RETURNS TABLE(operator_id uuid, operator_name text, operator_code text, otp_provider text, country_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cleaned_phone text;
  detected_country_code text;
BEGIN
  -- Remove + and spaces from phone number for matching
  cleaned_phone := regexp_replace(phone_number, '[^0-9]', '', 'g');
  
  -- Detect country code from the phone number
  -- Common country codes: 244 (Angola), 27 (South Africa), 254 (Kenya), 258 (Mozambique), etc.
  detected_country_code := CASE
    WHEN cleaned_phone LIKE '244%' THEN 'AO'  -- Angola
    WHEN cleaned_phone LIKE '27%' THEN 'ZA'   -- South Africa
    WHEN cleaned_phone LIKE '254%' THEN 'KE'  -- Kenya
    WHEN cleaned_phone LIKE '258%' THEN 'MZ'  -- Mozambique
    WHEN cleaned_phone LIKE '260%' THEN 'ZM'  -- Zambia
    WHEN cleaned_phone LIKE '263%' THEN 'ZW'  -- Zimbabwe
    WHEN cleaned_phone LIKE '234%' THEN 'NG'  -- Nigeria
    WHEN cleaned_phone LIKE '233%' THEN 'GH'  -- Ghana
    ELSE NULL
  END;
  
  RETURN QUERY
  SELECT 
    t.id,
    t.operator_name,
    t.operator_code,
    t.otp_provider,
    t.country_code
  FROM public.telecom_operators t
  WHERE t.is_active = true
    -- Match country code first
    AND (detected_country_code IS NULL OR t.country_code = detected_country_code)
    -- Then match prefix after country code
    AND EXISTS (
      SELECT 1
      FROM unnest(t.phone_prefixes) AS prefix
      WHERE cleaned_phone LIKE (
        CASE 
          WHEN t.country_code = 'AO' THEN '244' || prefix || '%'
          WHEN t.country_code = 'ZA' THEN '27' || prefix || '%'
          WHEN t.country_code = 'KE' THEN '254' || prefix || '%'
          WHEN t.country_code = 'MZ' THEN '258' || prefix || '%'
          WHEN t.country_code = 'ZM' THEN '260' || prefix || '%'
          WHEN t.country_code = 'ZW' THEN '263' || prefix || '%'
          WHEN t.country_code = 'NG' THEN '234' || prefix || '%'
          WHEN t.country_code = 'GH' THEN '233' || prefix || '%'
          ELSE prefix || '%'
        END
      )
    )
  -- Order by: country match first, then longest prefix match
  ORDER BY 
    CASE WHEN t.country_code = detected_country_code THEN 1 ELSE 2 END,
    array_length(t.phone_prefixes, 1) DESC
  LIMIT 1;
END;
$function$;