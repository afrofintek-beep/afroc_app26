
-- FIX CRITICAL: Remove public access policy from biometric_devices
DROP POLICY IF EXISTS "Allow checking trusted devices by phone" ON public.biometric_devices;

-- Create proper policy - only authenticated users can see their own devices
CREATE POLICY "Users can view their own biometric devices"
ON public.biometric_devices
FOR SELECT
USING (auth.uid() = user_id);