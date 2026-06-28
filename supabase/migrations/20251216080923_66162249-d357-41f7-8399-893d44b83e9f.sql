-- FIX: Restrict telecom_operators to authenticated users only
DROP POLICY IF EXISTS "Anyone can view active telecom operators" ON public.telecom_operators;

-- Create new policy for authenticated users only
CREATE POLICY "Authenticated users can view active telecom operators"
ON public.telecom_operators
FOR SELECT
USING (is_active = true AND auth.uid() IS NOT NULL);