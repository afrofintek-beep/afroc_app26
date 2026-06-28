-- Fix notification INSERT policy by removing overly permissive policy
-- The create_validator_notification() function uses SECURITY DEFINER and will bypass RLS anyway
DROP POLICY IF EXISTS "System can insert notifications" ON public.validator_notifications;

-- Create restrictive policy that only allows service role to insert
CREATE POLICY "Only service role can insert notifications"
  ON public.validator_notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);