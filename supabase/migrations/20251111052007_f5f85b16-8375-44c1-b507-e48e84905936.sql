-- Fix search_path for get_telecom_operator_by_phone function
ALTER FUNCTION public.get_telecom_operator_by_phone(text) SET search_path = public;