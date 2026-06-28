-- Drop the existing policy that exposes OTP codes
DROP POLICY IF EXISTS "Users can view witnesses for their records" ON afroid_witnesses;

-- Create new policy that only allows viewing witnesses after OTP is cleared
CREATE POLICY "Users can view witnesses for their records"
ON afroid_witnesses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM afroid_records
    WHERE afroid_records.id = afroid_witnesses.afroid_record_id
    AND afroid_records.user_id = auth.uid()
  )
  AND otp_code IS NULL  -- Only allow viewing after OTP is cleared (post-confirmation)
);