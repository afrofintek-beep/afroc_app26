-- Allow users to update address fields even on verified records
-- This is important for transitioning from digital to formal addresses
CREATE POLICY "Users can update address fields on their own records"
ON public.afroid_records
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Drop the restrictive policy that only allowed draft updates
DROP POLICY IF EXISTS "Users can update their own draft records" ON public.afroid_records;