-- Add property_name column for condominium/building names (user-attributed, not official)
ALTER TABLE public.afroloc_records ADD COLUMN IF NOT EXISTS property_name TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN public.afroloc_records.property_name IS 'User-attributed property/building name (e.g. Condomínio Paraíso Real). Not part of official administrative hierarchy. Should be displayed with unverified indicator.';