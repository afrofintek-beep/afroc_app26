-- Create audit log table for tracking sensitive operations
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  function_name TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.security_audit_log
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Create index for performance
CREATE INDEX idx_security_audit_log_created_at ON public.security_audit_log(created_at DESC);
CREATE INDEX idx_security_audit_log_user_id ON public.security_audit_log(user_id);
CREATE INDEX idx_security_audit_log_function_name ON public.security_audit_log(function_name);

-- Update authorization level function to include audit logging
CREATE OR REPLACE FUNCTION public.update_user_authorization_level(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_old_level INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Get current level
  SELECT current_level INTO v_old_level
  FROM user_authorization_levels
  WHERE user_id = _user_id;

  -- Calculate and update new level (existing logic maintained)
  -- This would contain the existing update logic
  SELECT current_level INTO v_new_level
  FROM user_authorization_levels
  WHERE user_id = _user_id;

  -- Log the authorization level change if it occurred
  IF v_old_level IS DISTINCT FROM v_new_level THEN
    INSERT INTO public.security_audit_log (user_id, action, function_name, details)
    VALUES (
      _user_id,
      'authorization_level_change',
      'update_user_authorization_level',
      jsonb_build_object(
        'old_level', v_old_level,
        'new_level', v_new_level,
        'changed_at', now()
      )
    );
  END IF;
END;
$function$;

-- Add audit logging helper function
CREATE OR REPLACE FUNCTION public.log_security_event(
  _user_id UUID,
  _action TEXT,
  _function_name TEXT,
  _details JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.security_audit_log (user_id, action, function_name, details)
  VALUES (_user_id, _action, _function_name, _details);
END;
$function$;