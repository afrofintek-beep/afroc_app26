-- Create function to check AFROLOC record limit per user
CREATE OR REPLACE FUNCTION public.check_afroloc_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER;
  v_max_limit INTEGER := 3;
BEGIN
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

-- Create trigger to enforce the limit on insert
CREATE TRIGGER enforce_afroloc_limit
  BEFORE INSERT ON public.afroloc_records
  FOR EACH ROW
  EXECUTE FUNCTION public.check_afroloc_limit();