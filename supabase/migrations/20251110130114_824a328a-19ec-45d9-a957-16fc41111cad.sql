-- Update the handle_new_user function to include country, city, and purpose from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    phone, 
    country, 
    city, 
    purpose,
    onboarding_completed
  )
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'country',
    new.raw_user_meta_data ->> 'city',
    CASE 
      WHEN new.raw_user_meta_data ->> 'purpose' IS NOT NULL 
      THEN ARRAY(SELECT jsonb_array_elements_text((new.raw_user_meta_data ->> 'purpose')::jsonb))
      ELSE NULL
    END,
    CASE 
      WHEN new.raw_user_meta_data ->> 'country' IS NOT NULL 
      THEN true
      ELSE false
    END
  );
  RETURN new;
END;
$$;