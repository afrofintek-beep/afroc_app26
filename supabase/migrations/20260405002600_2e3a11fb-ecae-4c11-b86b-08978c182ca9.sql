
-- Drop the trigger that depends on pgcrypto digest()
DROP TRIGGER IF EXISTS trg_hash_partner_api_key ON public.partner_api_keys;
DROP FUNCTION IF EXISTS public.hash_partner_api_key();

-- Remove the default empty string constraint so we can insert with pre-computed hash
ALTER TABLE public.partner_api_keys ALTER COLUMN api_key_hash SET DEFAULT '';
