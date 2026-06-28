
-- Function to clear urban zones (admin only, via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.clear_urban_zones()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  TRUNCATE TABLE public.urban_zones RESTART IDENTITY;
END;
$$;
