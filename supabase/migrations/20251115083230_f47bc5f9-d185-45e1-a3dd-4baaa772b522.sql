-- Add address type classification to distinguish formal vs digital addresses
-- Add address_type column to afroid_records
ALTER TABLE public.afroid_records 
ADD COLUMN IF NOT EXISTS address_type TEXT DEFAULT 'digital';

-- Add check constraint for valid address types
ALTER TABLE public.afroid_records
ADD CONSTRAINT afroid_records_address_type_check 
CHECK (address_type IN ('formal', 'digital'));

-- Comment explaining the address types
COMMENT ON COLUMN public.afroid_records.address_type IS 
'Type of address: 
- formal: Official street names and numbers assigned by government administration
- digital: Digital address created for areas without formal addressing system';

-- Create function to determine address type based on street and number presence
CREATE OR REPLACE FUNCTION public.determine_address_type(
  p_street_name TEXT,
  p_number TEXT,
  p_street_code TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Address is formal if it has both street name and number
  -- Street code indicates it's part of official street registry
  IF p_street_name IS NOT NULL AND p_street_name != '' 
     AND p_number IS NOT NULL AND p_number != ''
     AND p_street_code IS NOT NULL AND p_street_code != '' THEN
    RETURN 'formal';
  ELSE
    RETURN 'digital';
  END IF;
END;
$$;

-- Create trigger to automatically set address type on insert/update
CREATE OR REPLACE FUNCTION public.set_address_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.address_type := determine_address_type(
    NEW.street_name,
    NEW.number,
    NEW.street_code
  );
  RETURN NEW;
END;
$$;

-- Create trigger for insert
DROP TRIGGER IF EXISTS set_address_type_on_insert ON public.afroid_records;
CREATE TRIGGER set_address_type_on_insert
  BEFORE INSERT ON public.afroid_records
  FOR EACH ROW
  EXECUTE FUNCTION public.set_address_type();

-- Create trigger for update
DROP TRIGGER IF EXISTS set_address_type_on_update ON public.afroid_records;
CREATE TRIGGER set_address_type_on_update
  BEFORE UPDATE OF street_name, number, street_code ON public.afroid_records
  FOR EACH ROW
  EXECUTE FUNCTION public.set_address_type();

-- Update existing records to set their address type
UPDATE public.afroid_records
SET address_type = determine_address_type(street_name, number, street_code);

-- Add index for efficient filtering by address type
CREATE INDEX IF NOT EXISTS idx_afroid_records_address_type 
ON public.afroid_records(address_type);

-- Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_afroid_records_country_address_type 
ON public.afroid_records(country, address_type);

COMMENT ON FUNCTION public.determine_address_type IS 
'Determines if an address is formal (official government-assigned street/number) or digital (created for areas without formal addressing)';

COMMENT ON FUNCTION public.set_address_type IS 
'Trigger function to automatically classify address type based on street name, number, and street code presence';