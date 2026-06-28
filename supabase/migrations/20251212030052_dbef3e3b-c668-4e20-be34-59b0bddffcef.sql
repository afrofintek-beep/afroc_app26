-- Rename afroid_code to afroloc_code in witness_contract_downloads table
ALTER TABLE public.witness_contract_downloads 
RENAME COLUMN afroid_code TO afroloc_code;