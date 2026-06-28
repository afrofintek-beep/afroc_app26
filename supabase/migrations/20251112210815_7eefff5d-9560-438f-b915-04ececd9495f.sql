-- Create notifications table
CREATE TABLE IF NOT EXISTS public.validator_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- Create index for faster queries
CREATE INDEX idx_validator_notifications_user_id ON public.validator_notifications(user_id);
CREATE INDEX idx_validator_notifications_created_at ON public.validator_notifications(created_at DESC);
CREATE INDEX idx_validator_notifications_read ON public.validator_notifications(user_id, read);

-- Enable RLS
ALTER TABLE public.validator_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
  ON public.validator_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.validator_notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.validator_notifications
  FOR INSERT
  WITH CHECK (true);

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_validator_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_priority TEXT DEFAULT 'normal'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.validator_notifications (
    user_id,
    type,
    title,
    message,
    metadata,
    priority
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_metadata,
    p_priority
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.validator_notifications
  SET read = true, read_at = now()
  WHERE id = p_notification_id
    AND user_id = auth.uid();
END;
$$;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.validator_notifications
  SET read = true, read_at = now()
  WHERE user_id = auth.uid()
    AND read = false;
END;
$$;

-- Trigger to notify validators when new witness request is created
CREATE OR REPLACE FUNCTION public.notify_validator_new_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validator_id UUID;
  v_afroid_code TEXT;
BEGIN
  -- Get validator for this jurisdiction
  SELECT vpn.validator_user_id, ar.code
  INTO v_validator_id, v_afroid_code
  FROM validation_phone_numbers vpn
  JOIN afroid_records ar ON ar.id = NEW.afroid_record_id
  JOIN administrative_divisions ad ON ad.country_code = ar.country
    AND (ad.code = ar.level1_code OR ad.code = ar.level2_code 
         OR ad.code = ar.level3_code OR ad.code = ar.level4_code)
  WHERE vpn.administrative_division_id = ad.id
    AND vpn.is_active = true
  LIMIT 1;

  IF v_validator_id IS NOT NULL THEN
    PERFORM create_validator_notification(
      v_validator_id,
      'new_validation_request',
      'Nova Solicitação de Validação',
      'Há um novo pedido de validação de testemunho aguardando sua análise.',
      jsonb_build_object(
        'witness_id', NEW.id,
        'afroid_code', v_afroid_code,
        'afroid_record_id', NEW.afroid_record_id
      ),
      'high'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_validator_new_request
  AFTER INSERT ON public.afroid_witnesses
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_validator_new_request();

-- Trigger to notify requester when validation is completed
CREATE OR REPLACE FUNCTION public.notify_requester_validation_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_id UUID;
  v_afroid_code TEXT;
BEGIN
  IF NEW.status IN ('confirmed', 'rejected') AND OLD.status = 'pending' THEN
    -- Get requester user id
    SELECT ar.user_id, ar.code
    INTO v_requester_id, v_afroid_code
    FROM afroid_records ar
    WHERE ar.id = NEW.afroid_record_id;

    IF v_requester_id IS NOT NULL THEN
      PERFORM create_validator_notification(
        v_requester_id,
        'validation_completed',
        CASE 
          WHEN NEW.status = 'confirmed' THEN 'Validação Aprovada'
          ELSE 'Validação Rejeitada'
        END,
        CASE 
          WHEN NEW.status = 'confirmed' THEN 'Seu testemunho foi validado com sucesso.'
          ELSE 'Seu testemunho foi rejeitado. Motivo: ' || COALESCE(NEW.rejection_reason, 'Não especificado')
        END,
        jsonb_build_object(
          'witness_id', NEW.id,
          'afroid_code', v_afroid_code,
          'status', NEW.status,
          'rejection_reason', NEW.rejection_reason
        ),
        CASE 
          WHEN NEW.status = 'confirmed' THEN 'normal'
          ELSE 'high'
        END
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_requester_validation_completed
  AFTER UPDATE ON public.afroid_witnesses
  FOR EACH ROW
  EXECUTE FUNCTION notify_requester_validation_completed();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.validator_notifications;