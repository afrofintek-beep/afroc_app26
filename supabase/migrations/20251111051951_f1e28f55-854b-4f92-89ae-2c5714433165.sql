-- Insert Angolan telecom operators
INSERT INTO public.telecom_operators (country_code, operator_name, operator_code, phone_prefixes, otp_provider, is_active)
VALUES 
  ('AO', 'Unitel', 'UNITEL', ARRAY['923', '924', '926', '927'], 'twilio', true),
  ('AO', 'Movicel', 'MOVICEL', ARRAY['921', '922', '925'], 'twilio', true),
  ('AO', 'Africell', 'AFRICELL', ARRAY['928', '929'], 'twilio', true)
ON CONFLICT DO NOTHING;