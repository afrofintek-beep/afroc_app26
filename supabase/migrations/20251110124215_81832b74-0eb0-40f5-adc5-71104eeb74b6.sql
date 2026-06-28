-- Add purpose field to profiles table to store user's intended use case
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS purpose TEXT[];

-- Add onboarding_completed flag to track if user completed the questionnaire
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

COMMENT ON COLUMN profiles.purpose IS 'Array of purposes for using AFRO ID (delivery, banking, postal, emergency, etc.)';
COMMENT ON COLUMN profiles.onboarding_completed IS 'Flag to track if user completed onboarding questionnaire';