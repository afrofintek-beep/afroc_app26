-- Add is_primary_residence column to afroloc_records
ALTER TABLE public.afroloc_records 
ADD COLUMN is_primary_residence boolean DEFAULT false;

-- Create a function to ensure only one primary residence per user
CREATE OR REPLACE FUNCTION public.ensure_single_primary_residence()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this record as primary residence
  IF NEW.is_primary_residence = true THEN
    -- Unset any other primary residence for this user
    UPDATE public.afroloc_records 
    SET is_primary_residence = false 
    WHERE user_id = NEW.user_id 
      AND id != NEW.id 
      AND is_primary_residence = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to enforce single primary residence
CREATE TRIGGER ensure_single_primary_residence_trigger
BEFORE INSERT OR UPDATE ON public.afroloc_records
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_primary_residence();

-- Add index for faster lookups
CREATE INDEX idx_afroloc_records_primary_residence 
ON public.afroloc_records(user_id, is_primary_residence) 
WHERE is_primary_residence = true;