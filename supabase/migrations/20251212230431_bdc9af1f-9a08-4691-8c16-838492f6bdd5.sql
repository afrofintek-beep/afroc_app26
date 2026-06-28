-- Create function to call edge function for critical fraud alerts
CREATE OR REPLACE FUNCTION public.notify_critical_fraud_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_afroloc_code TEXT;
  v_region_name TEXT;
BEGIN
  -- Only send email for critical and high severity flags
  IF NEW.severity IN ('critical', 'high') THEN
    -- Get AFROLOC code and region if available
    IF NEW.afroloc_record_id IS NOT NULL THEN
      SELECT code, level1_name
      INTO v_afroloc_code, v_region_name
      FROM afroloc_records
      WHERE id = NEW.afroloc_record_id;
    END IF;
    
    -- Log intent to send email (actual email sent via edge function call from app)
    INSERT INTO security_audit_log (
      user_id,
      action,
      function_name,
      details
    ) VALUES (
      NEW.witness_user_id,
      'fraud_alert_email_queued',
      'notify_critical_fraud_flag',
      jsonb_build_object(
        'flag_id', NEW.id,
        'flag_type', NEW.flag_type,
        'severity', NEW.severity,
        'description', NEW.description,
        'afroloc_code', v_afroloc_code,
        'region_name', v_region_name
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for critical fraud flag email notifications
DROP TRIGGER IF EXISTS on_critical_fraud_flag_email ON public.witness_fraud_flags;

CREATE TRIGGER on_critical_fraud_flag_email
  AFTER INSERT ON public.witness_fraud_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_critical_fraud_flag();