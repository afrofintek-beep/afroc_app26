-- Add country and city fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS city TEXT;

COMMENT ON COLUMN profiles.country IS 'User country code (ISO 3166-1 alpha-2)';
COMMENT ON COLUMN profiles.city IS 'User city name';