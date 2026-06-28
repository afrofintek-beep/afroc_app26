-- Complete cleanup for phone +244923300105
DO $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
BEGIN
  -- First, get all user_ids associated with this phone from profiles
  FOR v_profile_id, v_user_id IN 
    SELECT p.id, p.user_id 
    FROM profiles p 
    WHERE p.phone = '+244923300105'
  LOOP
    -- Delete from all related tables first (respecting foreign keys)
    DELETE FROM afroid_witnesses WHERE witness_user_id = v_user_id;
    DELETE FROM afroid_records WHERE user_id = v_user_id;
    DELETE FROM identity_documents WHERE user_id = v_user_id;
    DELETE FROM user_devices WHERE user_id = v_user_id;
    DELETE FROM biometric_devices WHERE user_id = v_user_id;
    DELETE FROM biometric_login_history WHERE user_id = v_user_id;
    DELETE FROM validator_notifications WHERE user_id = v_user_id;
    DELETE FROM push_subscriptions WHERE user_id = v_user_id;
    DELETE FROM user_authorization_levels WHERE user_id = v_user_id;
    DELETE FROM user_2fa_settings WHERE user_id = v_user_id;
    DELETE FROM two_factor_backup_codes WHERE user_id = v_user_id;
    DELETE FROM two_factor_codes WHERE user_id = v_user_id;
    DELETE FROM phone_change_attempts WHERE user_id = v_user_id;
    DELETE FROM offline_cache_metadata WHERE user_id = v_user_id;
    DELETE FROM user_roles WHERE user_id = v_user_id;
    DELETE FROM risk_alert_settings WHERE user_id = v_user_id;
    DELETE FROM risk_alerts_log WHERE user_id = v_user_id;
    
    -- Now delete the profile
    DELETE FROM profiles WHERE id = v_profile_id;
    
    -- Finally, delete from auth.users
    DELETE FROM auth.users WHERE id = v_user_id;
    
    RAISE NOTICE 'Deleted user % with phone +244923300105', v_user_id;
  END LOOP;
  
  -- Also clean up any orphaned auth.users with this phone but no profile
  FOR v_user_id IN 
    SELECT au.id 
    FROM auth.users au
    WHERE au.raw_user_meta_data->>'phone' = '+244923300105'
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = au.id)
  LOOP
    DELETE FROM auth.users WHERE id = v_user_id;
    RAISE NOTICE 'Deleted orphaned auth user % with phone +244923300105', v_user_id;
  END LOOP;
END $$;