-- Add RLS policies to allow users to manage their own biometric devices
CREATE POLICY "Users can insert their own biometric devices"
ON public.biometric_devices
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own biometric devices"
ON public.biometric_devices
FOR UPDATE
USING (auth.uid() = user_id);