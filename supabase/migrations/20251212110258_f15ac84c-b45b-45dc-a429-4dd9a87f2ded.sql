-- Add foreign key constraint with ON DELETE CASCADE to profiles table
-- First, we need to check if there's an existing constraint and drop it

-- Add the foreign key with CASCADE delete
DO $$ 
BEGIN
  -- Check if constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_user_id_fkey' 
    AND table_name = 'profiles'
  ) THEN
    -- Add foreign key constraint with CASCADE
    ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;
  ELSE
    -- Drop existing constraint and recreate with CASCADE
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_user_id_fkey;
    ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;
  END IF;
END $$;