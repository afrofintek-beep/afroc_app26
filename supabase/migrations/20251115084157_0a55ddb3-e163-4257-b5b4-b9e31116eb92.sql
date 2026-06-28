-- Create policy for authority updates to formal addresses with GPS coordinates
CREATE POLICY "Authorities can update formal addresses with GPS coordinates"
ON public.afroid_records
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_authorization_levels ual
    WHERE ual.user_id = auth.uid()
    AND ual.current_level >= 3
    AND ual.jurisdiction_country = afroid_records.country
  )
  AND afroid_records.address_type = 'formal'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_authorization_levels ual
    WHERE ual.user_id = auth.uid()
    AND ual.current_level >= 3
    AND ual.jurisdiction_country = afroid_records.country
  )
  AND afroid_records.address_type = 'formal'
);

-- Add GPS validation metadata to track authority validations
ALTER TABLE public.afroid_records 
ADD COLUMN IF NOT EXISTS gps_validated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS gps_validated_by_user_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS gps_validation_notes text;

-- Add index for efficient authority queries
CREATE INDEX IF NOT EXISTS idx_afroid_records_formal_addresses 
ON public.afroid_records(country, address_type) 
WHERE address_type = 'formal';

-- Function to log GPS validation
CREATE OR REPLACE FUNCTION public.log_gps_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if GPS coordinates were added or updated by someone other than the owner
  IF (NEW.geo_lat IS DISTINCT FROM OLD.geo_lat OR NEW.geo_lon IS DISTINCT FROM OLD.geo_lon)
     AND auth.uid() != NEW.user_id THEN
    NEW.gps_validated_at := now();
    NEW.gps_validated_by_user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for GPS validation logging
DROP TRIGGER IF EXISTS trigger_log_gps_validation ON public.afroid_records;
CREATE TRIGGER trigger_log_gps_validation
BEFORE UPDATE ON public.afroid_records
FOR EACH ROW
EXECUTE FUNCTION public.log_gps_validation();