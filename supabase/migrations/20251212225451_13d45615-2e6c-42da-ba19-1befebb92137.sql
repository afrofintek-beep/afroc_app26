-- Create trigger function to notify on significant reputation changes
CREATE OR REPLACE FUNCTION public.notify_reputation_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_significance_threshold NUMERIC := 10;
  v_notification_type TEXT;
  v_title TEXT;
  v_message TEXT;
  v_priority TEXT;
BEGIN
  -- Only notify if change is significant (>= 10 points)
  IF ABS(NEW.score_change) >= v_significance_threshold THEN
    -- Determine notification type and content based on change direction
    IF NEW.score_change > 0 THEN
      v_notification_type := 'reputation_increase';
      v_title := 'Reputação Aumentou';
      v_message := format('Sua reputação como testemunha aumentou em %s pontos. Nova pontuação: %s/100', 
                          ROUND(NEW.score_change, 1), ROUND(NEW.new_score, 1));
      v_priority := 'normal';
    ELSE
      v_notification_type := 'reputation_decrease';
      v_title := 'Reputação Diminuiu';
      v_message := format('Sua reputação como testemunha diminuiu em %s pontos. Nova pontuação: %s/100. Motivo: %s', 
                          ROUND(ABS(NEW.score_change), 1), ROUND(NEW.new_score, 1), COALESCE(NEW.reason, 'Não especificado'));
      v_priority := 'high';
    END IF;
    
    -- Create notification
    PERFORM create_validator_notification(
      NEW.witness_user_id,
      v_notification_type,
      v_title,
      v_message,
      jsonb_build_object(
        'previous_score', NEW.previous_score,
        'new_score', NEW.new_score,
        'score_change', NEW.score_change,
        'action_type', NEW.action_type,
        'reason', NEW.reason
      ),
      v_priority
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on reputation history table
DROP TRIGGER IF EXISTS on_reputation_change_notify ON public.witness_reputation_history;
CREATE TRIGGER on_reputation_change_notify
  AFTER INSERT ON public.witness_reputation_history
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_reputation_change();