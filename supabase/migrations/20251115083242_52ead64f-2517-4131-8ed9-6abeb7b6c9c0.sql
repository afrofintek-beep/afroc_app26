-- Fix security warnings for search_path in trigger functions
CREATE OR REPLACE FUNCTION public.set_address_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.address_type := determine_address_type(
    NEW.street_name,
    NEW.number,
    NEW.street_code
  );
  RETURN NEW;
END;
$$;