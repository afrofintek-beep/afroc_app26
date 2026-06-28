-- Add validation tracking fields to afroid_witnesses
ALTER TABLE public.afroid_witnesses
ADD COLUMN IF NOT EXISTS validated_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create index for faster queries by validator
CREATE INDEX IF NOT EXISTS idx_afroid_witnesses_status ON public.afroid_witnesses(status);

-- Update RLS policies for validators to view requests in their jurisdiction
CREATE POLICY "Validators can view requests for their jurisdiction"
ON public.afroid_witnesses
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM validation_phone_numbers vpn
    JOIN afroid_records ar ON ar.id = afroid_witnesses.afroid_record_id
    JOIN administrative_divisions ad ON (
      ad.country_code = ar.country AND
      (ad.code = ar.level1_code OR ad.code = ar.level2_code OR ad.code = ar.level3_code OR ad.code = ar.level4_code)
    )
    WHERE vpn.validator_user_id = auth.uid()
      AND vpn.administrative_division_id = ad.id
      AND afroid_witnesses.status = 'pending'
  )
);

-- Validators can update validation status
CREATE POLICY "Validators can update validation status"
ON public.afroid_witnesses
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM validation_phone_numbers vpn
    JOIN afroid_records ar ON ar.id = afroid_witnesses.afroid_record_id
    JOIN administrative_divisions ad ON (
      ad.country_code = ar.country AND
      (ad.code = ar.level1_code OR ad.code = ar.level2_code OR ad.code = ar.level3_code OR ad.code = ar.level4_code)
    )
    WHERE vpn.validator_user_id = auth.uid()
      AND vpn.administrative_division_id = ad.id
  )
);