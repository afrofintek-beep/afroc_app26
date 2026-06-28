-- Add unique constraint for biometric_devices upsert
CREATE UNIQUE INDEX IF NOT EXISTS biometric_devices_user_phone_fingerprint_unique 
ON public.biometric_devices (user_id, phone_number, device_fingerprint);