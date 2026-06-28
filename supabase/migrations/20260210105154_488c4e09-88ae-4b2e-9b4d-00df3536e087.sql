-- Add yamioo_agent to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'yamioo_agent';