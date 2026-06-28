-- Add EXIF metadata columns to afroid_records
ALTER TABLE public.afroid_records
ADD COLUMN IF NOT EXISTS photo_exif_gps_lat DECIMAL(10, 6),
ADD COLUMN IF NOT EXISTS photo_exif_gps_lon DECIMAL(10, 6),
ADD COLUMN IF NOT EXISTS photo_exif_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS photo_exif_device_make TEXT,
ADD COLUMN IF NOT EXISTS photo_exif_device_model TEXT,
ADD COLUMN IF NOT EXISTS photo_metadata JSONB;

-- Add comment explaining the columns
COMMENT ON COLUMN public.afroid_records.photo_exif_gps_lat IS 'GPS latitude extracted from photo EXIF data';
COMMENT ON COLUMN public.afroid_records.photo_exif_gps_lon IS 'GPS longitude extracted from photo EXIF data';
COMMENT ON COLUMN public.afroid_records.photo_exif_timestamp IS 'Photo capture timestamp from EXIF data';
COMMENT ON COLUMN public.afroid_records.photo_exif_device_make IS 'Device manufacturer from EXIF (e.g., Apple, Samsung)';
COMMENT ON COLUMN public.afroid_records.photo_exif_device_model IS 'Device model from EXIF (e.g., iPhone 14 Pro)';
COMMENT ON COLUMN public.afroid_records.photo_metadata IS 'Complete photo EXIF metadata as JSON';