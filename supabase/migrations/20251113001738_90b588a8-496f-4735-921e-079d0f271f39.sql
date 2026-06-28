-- Create improved merge function that handles unique constraints
CREATE OR REPLACE FUNCTION public.merge_duplicate_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    
    -- Transfer AFRO ID records
    UPDATE afroid_records
    SET user_id = v_keep_user_id
    WHERE user_id = ANY(v_duplicate_user_ids);
    
    -- Transfer witnesses
    UPDATE afroid_witnesses
    SET witness_user_id = v_keep_user_id
    WHERE witness_user_id = ANY(v_duplicate_user_ids);
    
    -- Transfer identity documents
    UPDATE identity_documents
    SET user_id = v_keep_user_id
    WHERE user_id = ANY(v_duplicate_user_ids);
    
    -- Handle user_devices (has unique constraint on user_id + device_fingerprint)
    -- Delete devices from duplicate accounts that would conflict
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
    
    -- Log the merge
    RAISE NOTICE 'Merged % duplicate profiles for phone %', array_length(v_duplicate_user_ids, 1), v_phone;
  END LOOP;
END;
$$;

-- Execute the merge function
SELECT public.merge_duplicate_profiles();

-- Add unique constraint on phone
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_phone_unique UNIQUE (phone);

-- Create index for faster phone lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone 
ON public.profiles(phone) 
WHERE phone IS NOT NULL;

-- Create function to check phone availability
CREATE OR REPLACE FUNCTION public.is_phone_available(p_phone TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM profiles WHERE phone = p_phone
  );
END;
$$;

-- Create function to find user by phone
CREATE OR REPLACE FUNCTION public.get_user_by_phone(p_phone TEXT)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  afro_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.full_name,
    au.email,
    p.phone,
    p.afro_id,
    p.created_at
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE p.phone = p_phone;
END;
$$;

COMMENT ON CONSTRAINT profiles_phone_unique ON profiles IS 'Ensures one phone number per account - phone is primary identity';
COMMENT ON FUNCTION public.merge_duplicate_profiles IS 'Merges duplicate profiles with same phone number, keeping most recent and handling constraint conflicts';
COMMENT ON FUNCTION public.is_phone_available IS 'Checks if a phone number is available for registration';
COMMENT ON FUNCTION public.get_user_by_phone IS 'Retrieves user information by phone number';
