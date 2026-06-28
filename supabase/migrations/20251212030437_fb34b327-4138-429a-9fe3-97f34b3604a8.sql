-- Update merge_duplicate_profiles function to use new table names
CREATE OR REPLACE FUNCTION public.merge_duplicate_profiles()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phone TEXT;
  v_keep_user_id UUID;
  v_duplicate_user_ids UUID[];
BEGIN
  -- For each phone number that has duplicates
  FOR v_phone IN
    SELECT phone
    FROM profiles
    WHERE phone IS NOT NULL
    GROUP BY phone
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the most recent profile
    SELECT user_id INTO v_keep_user_id
    FROM profiles
    WHERE phone = v_phone
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Get all duplicate user IDs (excluding the one we're keeping)
    SELECT ARRAY_AGG(user_id) INTO v_duplicate_user_ids
    FROM profiles
    WHERE phone = v_phone
      AND user_id != v_keep_user_id;
    
    -- Transfer AFROLOC records
    UPDATE afroloc_records
    SET user_id = v_keep_user_id
    WHERE user_id = ANY(v_duplicate_user_ids);
    
    -- Transfer witnesses
    UPDATE afroloc_witnesses
    SET witness_user_id = v_keep_user_id
    WHERE witness_user_id = ANY(v_duplicate_user_ids);
    
    -- Transfer identity documents
    UPDATE identity_documents
    SET user_id = v_keep_user_id
    WHERE user_id = ANY(v_duplicate_user_ids);
    
    -- Handle user_devices (has unique constraint on user_id + device_fingerprint)
    DELETE FROM user_devices
    WHERE user_id = ANY(v_duplicate_user_ids)
      AND device_fingerprint IN (
        SELECT device_fingerprint 
        FROM user_devices 
        WHERE user_id = v_keep_user_id
      );
    
    -- Now update remaining devices
    UPDATE user_devices
    SET user_id = v_keep_user_id
    WHERE user_id = ANY(v_duplicate_user_ids);
    
    -- Transfer biometric login history
    UPDATE biometric_login_history
    SET user_id = v_keep_user_id
    WHERE user_id = ANY(v_duplicate_user_ids);
    
    -- Transfer notifications
    UPDATE validator_notifications
    SET user_id = v_keep_user_id
    WHERE user_id = ANY(v_duplicate_user_ids);
    
    -- Transfer push subscriptions
    UPDATE push_subscriptions
    SET user_id = v_keep_user_id
    WHERE user_id = ANY(v_duplicate_user_ids);
    
    -- Transfer authorization levels
    UPDATE user_authorization_levels
    SET user_id = v_keep_user_id
    WHERE user_id = ANY(v_duplicate_user_ids);
    
    -- Transfer 2FA settings
    UPDATE user_2fa_settings
    SET user_id = v_keep_user_id
    WHERE user_id = ANY(v_duplicate_user_ids);
    
    -- Transfer backup codes
    UPDATE two_factor_backup_codes
    SET user_id = v_keep_user_id
    WHERE user_id = ANY(v_duplicate_user_ids);
    
    -- Delete duplicate profiles
    DELETE FROM profiles
    WHERE phone = v_phone
      AND user_id = ANY(v_duplicate_user_ids);
    
    RAISE NOTICE 'Merged % duplicate profiles for phone %', array_length(v_duplicate_user_ids, 1), v_phone;
  END LOOP;
END;
$function$;

-- Update get_fraud_detection_metrics function to use new table names
CREATE OR REPLACE FUNCTION public.get_fraud_detection_metrics(p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(total_requests bigint, expired_otps bigint, rejected_validations bigint, suspicious_patterns bigint, fraud_risk_percentage numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(aw.id) as total_requests,
    COUNT(CASE WHEN aw.otp_expires_at < NOW() AND aw.status = 'pending' THEN 1 END) as expired_otps,
    COUNT(CASE WHEN aw.status = 'rejected' THEN 1 END) as rejected_validations,
    COUNT(CASE 
      WHEN aw.status = 'rejected' 
        AND aw.rejection_reason LIKE '%fraud%' 
        OR aw.rejection_reason LIKE '%suspicious%' 
      THEN 1 
    END) as suspicious_patterns,
    ROUND(
      (COUNT(CASE WHEN aw.status = 'rejected' THEN 1 END)::NUMERIC / 
       NULLIF(COUNT(aw.id), 0)) * 100, 
      2
    ) as fraud_risk_percentage
  FROM afroloc_witnesses aw
  WHERE 
    (p_start_date IS NULL OR aw.created_at >= p_start_date)
    AND (p_end_date IS NULL OR aw.created_at <= p_end_date);
END;
$function$;

-- Update get_validation_stats_by_region function to use new table names
CREATE OR REPLACE FUNCTION public.get_validation_stats_by_region(p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(region_name text, total_validations bigint, approved_count bigint, rejected_count bigint, approval_rate numeric, avg_response_time_minutes numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(ar.level1_name, 'Unknown') as region_name,
    COUNT(aw.id) as total_validations,
    COUNT(CASE WHEN aw.status = 'confirmed' THEN 1 END) as approved_count,
    COUNT(CASE WHEN aw.status = 'rejected' THEN 1 END) as rejected_count,
    ROUND(
      (COUNT(CASE WHEN aw.status = 'confirmed' THEN 1 END)::NUMERIC / 
       NULLIF(COUNT(CASE WHEN aw.status IN ('confirmed', 'rejected') THEN 1 END), 0)) * 100, 
      2
    ) as approval_rate,
    ROUND(
      AVG(EXTRACT(EPOCH FROM (aw.validated_at - aw.created_at)) / 60),
      2
    ) as avg_response_time_minutes
  FROM afroloc_witnesses aw
  LEFT JOIN afroloc_records ar ON aw.afroloc_record_id = ar.id
  WHERE 
    aw.status IN ('confirmed', 'rejected')
    AND aw.validated_at IS NOT NULL
    AND (p_start_date IS NULL OR aw.validated_at >= p_start_date)
    AND (p_end_date IS NULL OR aw.validated_at <= p_end_date)
  GROUP BY ar.level1_name
  ORDER BY total_validations DESC;
END;
$function$;

-- Update get_validation_stats_by_validator function to use new table names
CREATE OR REPLACE FUNCTION public.get_validation_stats_by_validator(p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(validator_id uuid, validator_name text, total_validations bigint, approved_count bigint, rejected_count bigint, approval_rate numeric, avg_response_time_minutes numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    aw.validated_by_user_id as validator_id,
    COALESCE(p.full_name, 'Unknown Validator') as validator_name,
    COUNT(aw.id) as total_validations,
    COUNT(CASE WHEN aw.status = 'confirmed' THEN 1 END) as approved_count,
    COUNT(CASE WHEN aw.status = 'rejected' THEN 1 END) as rejected_count,
    ROUND(
      (COUNT(CASE WHEN aw.status = 'confirmed' THEN 1 END)::NUMERIC / 
       NULLIF(COUNT(CASE WHEN aw.status IN ('confirmed', 'rejected') THEN 1 END), 0)) * 100, 
      2
    ) as approval_rate,
    ROUND(
      AVG(EXTRACT(EPOCH FROM (aw.validated_at - aw.created_at)) / 60),
      2
    ) as avg_response_time_minutes
  FROM afroloc_witnesses aw
  LEFT JOIN profiles p ON aw.validated_by_user_id = p.user_id
  WHERE 
    aw.status IN ('confirmed', 'rejected')
    AND aw.validated_at IS NOT NULL
    AND aw.validated_by_user_id IS NOT NULL
    AND (p_start_date IS NULL OR aw.validated_at >= p_start_date)
    AND (p_end_date IS NULL OR aw.validated_at <= p_end_date)
  GROUP BY aw.validated_by_user_id, p.full_name
  ORDER BY total_validations DESC;
END;
$function$;

-- Update get_validation_trends function to use new table names
CREATE OR REPLACE FUNCTION public.get_validation_trends(p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_interval text DEFAULT 'day'::text)
 RETURNS TABLE(time_bucket timestamp with time zone, total_validations bigint, approved_count bigint, rejected_count bigint, pending_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC(p_interval, aw.created_at) as time_bucket,
    COUNT(aw.id) as total_validations,
    COUNT(CASE WHEN aw.status = 'confirmed' THEN 1 END) as approved_count,
    COUNT(CASE WHEN aw.status = 'rejected' THEN 1 END) as rejected_count,
    COUNT(CASE WHEN aw.status = 'pending' THEN 1 END) as pending_count
  FROM afroloc_witnesses aw
  WHERE 
    (p_start_date IS NULL OR aw.created_at >= p_start_date)
    AND (p_end_date IS NULL OR aw.created_at <= p_end_date)
  GROUP BY DATE_TRUNC(p_interval, aw.created_at)
  ORDER BY time_bucket DESC;
END;
$function$;