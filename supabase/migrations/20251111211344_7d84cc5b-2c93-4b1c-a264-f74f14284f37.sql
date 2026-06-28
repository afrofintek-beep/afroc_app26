-- Create a function to automatically assign citizen role on signup
CREATE OR REPLACE FUNCTION public.assign_citizen_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only assign citizen role if no other role is specified
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'citizen');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to assign citizen role when profile is created
DROP TRIGGER IF EXISTS on_profile_created_assign_role ON public.profiles;
CREATE TRIGGER on_profile_created_assign_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_citizen_role();

-- Backfill existing users without roles as citizens
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'citizen'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id
)
ON CONFLICT (user_id, role) DO NOTHING;