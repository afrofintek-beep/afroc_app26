-- Fix get_user_by_phone function type mismatch
DROP FUNCTION IF EXISTS public.get_user_by_phone(text);

CREATE OR REPLACE FUNCTION public.get_user_by_phone(p_phone text)
RETURNS TABLE(user_id uuid, full_name text, email text, phone text, afro_id text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.full_name,
    au.email::text,  -- Cast to text to match return type
    p.phone,
    p.afro_id,
    p.created_at
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE p.phone = p_phone;
END;
$$;

-- Clean up any incomplete user records for the phone +244923300105
-- This handles cases where auth.users was created but profile insertion failed
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Find any auth.users without a corresponding profile for this phone
  FOR v_user_id IN 
    SELECT au.id 
    FROM auth.users au
    WHERE au.raw_user_meta_data->>'phone' = '+244923300105'
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = au.id)
  LOOP
    -- Delete the orphaned auth user
    DELETE FROM auth.users WHERE id = v_user_id;
  END LOOP;
END $$;