-- Fix recursive RLS policies on security_events table
-- Drop existing policies with recursive user_roles queries
DROP POLICY IF EXISTS "Admins can view all security events" ON public.security_events;
DROP POLICY IF EXISTS "Admins can update security events" ON public.security_events;

-- Create corrected policies using has_role() function to prevent infinite recursion
CREATE POLICY "Admins can view all security events"
  ON public.security_events
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update security events"
  ON public.security_events
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));