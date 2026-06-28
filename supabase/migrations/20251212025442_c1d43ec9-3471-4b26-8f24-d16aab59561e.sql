-- Rename afroid_record_id column to afroloc_record_id in all tables

-- 1. afroloc_witnesses table
ALTER TABLE public.afroloc_witnesses 
RENAME COLUMN afroid_record_id TO afroloc_record_id;

-- 2. afroloc_validations table
ALTER TABLE public.afroloc_validations 
RENAME COLUMN afroid_record_id TO afroloc_record_id;

-- 3. identity_documents table
ALTER TABLE public.identity_documents 
RENAME COLUMN afroid_record_id TO afroloc_record_id;

-- 4. witness_contract_downloads table
ALTER TABLE public.witness_contract_downloads 
RENAME COLUMN afroid_record_id TO afroloc_record_id;

-- Update database functions that reference the old column name

-- Update notify_validator_new_request function
CREATE OR REPLACE FUNCTION public.notify_validator_new_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_validator_id UUID;
  v_afroloc_code TEXT;
BEGIN
  SELECT vpn.validator_user_id, ar.code
  INTO v_validator_id, v_afroloc_code
  FROM validation_phone_numbers vpn
  JOIN afroloc_records ar ON ar.id = NEW.afroloc_record_id
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
        'afroloc_code', v_afroloc_code,
        'afroloc_record_id', NEW.afroloc_record_id
      ),
      'high'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Update notify_requester_validation_completed function
CREATE OR REPLACE FUNCTION public.notify_requester_validation_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_requester_id UUID;
  v_afroloc_code TEXT;
BEGIN
  IF NEW.status IN ('confirmed', 'rejected') AND OLD.status = 'pending' THEN
    SELECT ar.user_id, ar.code
    INTO v_requester_id, v_afroloc_code
    FROM afroloc_records ar
    WHERE ar.id = NEW.afroloc_record_id;

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
          'afroloc_code', v_afroloc_code,
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
$function$;