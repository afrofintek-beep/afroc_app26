-- Create a helper function to check if user has any admin role
CREATE OR REPLACE FUNCTION public.has_admin_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'admin_national'::app_role, 'admin_province'::app_role, 'admin_municipality'::app_role)
  )
$$;

-- Create a function to check admin scope based on jurisdiction
CREATE OR REPLACE FUNCTION public.has_jurisdiction_access(
  _user_id uuid,
  _target_country text,
  _target_level1 text DEFAULT NULL,
  _target_level2 text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth user_authorization_levels%ROWTYPE;
BEGIN
  SELECT * INTO v_auth
  FROM user_authorization_levels
  WHERE user_id = _user_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- National admins (level 5) have access to entire country
  IF v_auth.current_level >= 5 AND v_auth.jurisdiction_country = _target_country THEN
    RETURN TRUE;
  END IF;
  
  -- Provincial admins (level 4) have access to their province
  IF v_auth.current_level >= 4 
     AND v_auth.jurisdiction_country = _target_country 
     AND v_auth.jurisdiction_level1_code = _target_level1 THEN
    RETURN TRUE;
  END IF;
  
  -- Municipal admins (level 3) have access to their municipality
  IF v_auth.current_level >= 3 
     AND v_auth.jurisdiction_country = _target_country 
     AND v_auth.jurisdiction_level1_code = _target_level1
     AND v_auth.jurisdiction_level2_code = _target_level2 THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;