-- Allow validators to view profiles of other validators for transparency
CREATE POLICY "Validators can view other validators profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM validation_phone_numbers vpn
    WHERE vpn.validator_user_id = auth.uid()
      AND vpn.is_active = true
  )
  AND EXISTS (
    SELECT 1
    FROM validation_phone_numbers vpn2
    WHERE vpn2.validator_user_id = profiles.user_id
      AND vpn2.is_active = true
  )
);