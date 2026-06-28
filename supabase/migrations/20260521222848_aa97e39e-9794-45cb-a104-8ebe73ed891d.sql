
-- Restrict afroloc_operators public read to authenticated users (protects api_key_encrypted)
DROP POLICY IF EXISTS "Anyone can view active operators" ON public.afroloc_operators;
CREATE POLICY "Authenticated users can view active operators"
  ON public.afroloc_operators FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Remove the broad self-update policy on witnesses (status/OTP transitions must go through
-- the verify-witness-otp edge function which uses the service role).
DROP POLICY IF EXISTS "Witnesses can update their own confirmations" ON public.afroloc_witnesses;
