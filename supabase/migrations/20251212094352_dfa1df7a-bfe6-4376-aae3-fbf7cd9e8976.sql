-- Drop existing trigger and function
DROP TRIGGER IF EXISTS enforce_afroloc_limit ON public.afroloc_records;
DROP FUNCTION IF EXISTS public.check_afroloc_limit();

-- Create updated function to check both limit and uniqueness
CREATE OR REPLACE FUNCTION public.check_afroloc_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER;
  v_max_limit INTEGER := 3;
  v_duplicate_exists BOOLEAN;
BEGIN
  -- Check if a similar address already exists for this user
  SELECT EXISTS (
    SELECT 1 FROM public.afroloc_records
    WHERE user_id = NEW.user_id
      AND country = NEW.country
      AND COALESCE(level1_name, '') = COALESCE(NEW.level1_name, '')
      AND COALESCE(level2_name, '') = COALESCE(NEW.level2_name, '')
      AND COALESCE(level3_name, '') = COALESCE(NEW.level3_name, '')
      AND COALESCE(level4_name, '') = COALESCE(NEW.level4_name, '')
      AND COALESCE(street_name, '') = COALESCE(NEW.street_name, '')
      AND COALESCE(number, '') = COALESCE(NEW.number, '')
      AND COALESCE(unit, '') = COALESCE(NEW.unit, '')
  ) INTO v_duplicate_exists;
  
  IF v_duplicate_exists THEN
    RAISE EXCEPTION 'Duplicate address: An address with the same location details already exists for this user';
  END IF;
  
  -- Count existing records for this user
  SELECT COUNT(*) INTO v_current_count
  FROM public.afroloc_records
  WHERE user_id = NEW.user_id;
  
  -- Check if limit would be exceeded
  IF v_current_count >= v_max_limit THEN
    RAISE EXCEPTION 'Maximum limit of % AFROLOC addresses per user exceeded', v_max_limit;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER enforce_afroloc_limit
  BEFORE INSERT ON public.afroloc_records
  FOR EACH ROW
  EXECUTE FUNCTION public.check_afroloc_limit();