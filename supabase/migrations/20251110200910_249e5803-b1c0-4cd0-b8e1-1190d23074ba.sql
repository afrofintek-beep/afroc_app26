-- Add property_type column to afroid_records table
ALTER TABLE public.afroid_records 
ADD COLUMN property_type text CHECK (property_type IN ('house', 'apartment', 'commercial', 'land', 'other'));