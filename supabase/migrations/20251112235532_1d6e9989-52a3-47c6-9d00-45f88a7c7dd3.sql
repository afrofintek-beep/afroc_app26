-- Add verification cycle tracking to afroid_records
ALTER TABLE public.afroid_records 
ADD COLUMN last_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN next_verification_due TIMESTAMP WITH TIME ZONE;

-- Create index for verification queries
CREATE INDEX idx_afroid_records_next_verification 
ON public.afroid_records(next_verification_due);

-- Function to determine address category
CREATE OR REPLACE FUNCTION public.get_address_category(
  p_street_name TEXT,
  p_number TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Full address: has both street name and number
  IF p_street_name IS NOT NULL AND p_street_name != '' 
     AND p_number IS NOT NULL AND p_number != '' THEN
    RETURN 'full_address';
  ELSE
    RETURN 'incomplete_address';
  END IF;
END;
$$;

-- Function to calculate next verification date
CREATE OR REPLACE FUNCTION public.calculate_next_verification_date(
  p_last_verified_at TIMESTAMP WITH TIME ZONE,
  p_street_name TEXT,
  p_number TEXT
)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category TEXT;
  v_cycle_months INTEGER;
  v_base_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Determine address category
  v_category := get_address_category(p_street_name, p_number);
  
  -- Set cycle duration: 6 months (2 cycles/year) or 3 months (4 cycles/year)
  IF v_category = 'full_address' THEN
    v_cycle_months := 6;  -- 2 verification cycles per year
  ELSE
    v_cycle_months := 3;  -- 4 verification cycles per year
  END IF;
  
  -- Use last verification date or now as base
  v_base_date := COALESCE(p_last_verified_at, NOW());
  
  -- Calculate next verification date
  RETURN v_base_date + (v_cycle_months || ' months')::INTERVAL;
END;
$$;

-- Trigger to automatically calculate next verification date
CREATE OR REPLACE FUNCTION public.update_verification_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Calculate next verification date when record is created or address changes
  NEW.next_verification_due := calculate_next_verification_date(
    NEW.last_verified_at,
    NEW.street_name,
    NEW.number
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS set_verification_date ON public.afroid_records;
CREATE TRIGGER set_verification_date
  BEFORE INSERT OR UPDATE OF street_name, number, last_verified_at
  ON public.afroid_records
  FOR EACH ROW
  EXECUTE FUNCTION update_verification_date();

COMMENT ON COLUMN public.afroid_records.last_verified_at IS 'Timestamp of last address verification';
COMMENT ON COLUMN public.afroid_records.next_verification_due IS 'Calculated date when next verification is due';
COMMENT ON FUNCTION public.get_address_category IS 'Determines if address is complete (full_address) or incomplete (incomplete_address)';
COMMENT ON FUNCTION public.calculate_next_verification_date IS 'Calculates next verification date: 6 months for full addresses (2 cycles/year), 3 months for incomplete (4 cycles/year)';
