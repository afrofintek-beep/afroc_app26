
-- Remove old constraint that only allows 'formal' and 'digital'
ALTER TABLE afroloc_records DROP CONSTRAINT IF EXISTS afroid_records_address_type_check;

-- Add new constraint that allows all 3 types: formal, informal, digital
ALTER TABLE afroloc_records ADD CONSTRAINT afroloc_records_address_type_check 
  CHECK (address_type IN ('formal', 'informal', 'digital'));
