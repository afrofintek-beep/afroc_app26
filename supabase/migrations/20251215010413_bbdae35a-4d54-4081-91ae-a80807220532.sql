-- Extend the app_role enum with new administrative roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_national';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_province';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_municipality';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operator_field';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor_read';