-- Add policy for checking trusted devices during login (before auth)
CREATE POLICY "Allow checking trusted devices by phone"
ON public.biometric_devices
FOR SELECT
USING (true);

-- Drop the old restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view own biometric devices" ON public.biometric_devices;