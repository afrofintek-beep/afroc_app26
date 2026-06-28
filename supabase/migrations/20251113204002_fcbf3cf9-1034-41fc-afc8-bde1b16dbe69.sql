
-- Create a function to setup first admin (will be called after user signs up)
CREATE OR REPLACE FUNCTION public.setup_first_admin(p_user_id UUID, p_full_name TEXT, p_phone TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile if not exists
  INSERT INTO public.profiles (user_id, full_name, phone, country, onboarding_completed)
  VALUES (p_user_id, p_full_name, p_phone, 'AO', true)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    country = EXCLUDED.country,
    onboarding_completed = true;

  -- Insert admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Insert national level authorization for Angola
  INSERT INTO public.user_authorization_levels (
    user_id,
    current_level,
    jurisdiction_country,
    jurisdiction_level1_code,
    jurisdiction_level1_name,
    administrative_role
  )
  VALUES (
    p_user_id,
    5,
    'AO',
    NULL,
    NULL,
    'Administrador Nacional'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    current_level = 5,
    jurisdiction_country = 'AO',
    administrative_role = 'Administrador Nacional',
    updated_at = NOW();
END;
$$;
