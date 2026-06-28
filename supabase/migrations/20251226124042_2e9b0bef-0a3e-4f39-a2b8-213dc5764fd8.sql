-- Add new values to afroloc_status enum for pending validation workflow
ALTER TYPE afroloc_status ADD VALUE IF NOT EXISTS 'pending_validation';
ALTER TYPE afroloc_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE afroloc_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE afroloc_status ADD VALUE IF NOT EXISTS 'pending';