-- Step 1: Rename tables
ALTER TABLE public.afroid_records RENAME TO afroloc_records;
ALTER TABLE public.afroid_witnesses RENAME TO afroloc_witnesses;
ALTER TABLE public.afroid_validations RENAME TO afroloc_validations;

-- Step 2: Rename the enum type
ALTER TYPE public.afroid_status RENAME TO afroloc_status;

-- Step 3: Update foreign key constraints (drop and recreate with new names)
-- afroloc_records -> registration_batches
ALTER TABLE public.afroloc_records DROP CONSTRAINT IF EXISTS afroid_records_batch_id_fkey;
ALTER TABLE public.afroloc_records ADD CONSTRAINT afroloc_records_batch_id_fkey 
  FOREIGN KEY (batch_id) REFERENCES public.registration_batches(id);

-- afroloc_witnesses -> afroloc_records
ALTER TABLE public.afroloc_witnesses DROP CONSTRAINT IF EXISTS afroid_witnesses_afroid_record_id_fkey;
ALTER TABLE public.afroloc_witnesses ADD CONSTRAINT afroloc_witnesses_afroloc_record_id_fkey 
  FOREIGN KEY (afroid_record_id) REFERENCES public.afroloc_records(id);

-- afroloc_validations -> afroloc_records
ALTER TABLE public.afroloc_validations DROP CONSTRAINT IF EXISTS afroid_validations_afroid_record_id_fkey;
ALTER TABLE public.afroloc_validations ADD CONSTRAINT afroloc_validations_afroloc_record_id_fkey 
  FOREIGN KEY (afroid_record_id) REFERENCES public.afroloc_records(id);

-- identity_documents -> afroloc_records
ALTER TABLE public.identity_documents DROP CONSTRAINT IF EXISTS identity_documents_afroid_record_id_fkey;
ALTER TABLE public.identity_documents ADD CONSTRAINT identity_documents_afroloc_record_id_fkey 
  FOREIGN KEY (afroid_record_id) REFERENCES public.afroloc_records(id);

-- witness_contract_downloads -> afroloc_records
ALTER TABLE public.witness_contract_downloads DROP CONSTRAINT IF EXISTS witness_contract_downloads_afroid_record_id_fkey;
ALTER TABLE public.witness_contract_downloads ADD CONSTRAINT witness_contract_downloads_afroloc_record_id_fkey 
  FOREIGN KEY (afroid_record_id) REFERENCES public.afroloc_records(id);

-- witness_contract_downloads -> afroloc_witnesses
ALTER TABLE public.witness_contract_downloads DROP CONSTRAINT IF EXISTS witness_contract_downloads_witness_id_fkey;
ALTER TABLE public.witness_contract_downloads ADD CONSTRAINT witness_contract_downloads_afroloc_witness_id_fkey 
  FOREIGN KEY (witness_id) REFERENCES public.afroloc_witnesses(id);

-- Step 4: Drop old RLS policies for afroid_records (now afroloc_records)
DROP POLICY IF EXISTS "Admins can update any record" ON public.afroloc_records;
DROP POLICY IF EXISTS "Admins can view all records" ON public.afroloc_records;
DROP POLICY IF EXISTS "Authorities can update formal addresses with GPS coordinates" ON public.afroloc_records;
DROP POLICY IF EXISTS "Registered users can create records" ON public.afroloc_records;
DROP POLICY IF EXISTS "Users can update address fields on their own records" ON public.afroloc_records;
DROP POLICY IF EXISTS "Users can view their own records" ON public.afroloc_records;

-- Step 5: Recreate RLS policies for afroloc_records
CREATE POLICY "Admins can update any record" ON public.afroloc_records
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all records" ON public.afroloc_records
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authorities can update formal addresses with GPS coordinates" ON public.afroloc_records
FOR UPDATE USING (
  (EXISTS (SELECT 1 FROM user_authorization_levels ual
   WHERE ual.user_id = auth.uid() AND ual.current_level >= 3 AND ual.jurisdiction_country = afroloc_records.country))
  AND address_type = 'formal'
) WITH CHECK (
  (EXISTS (SELECT 1 FROM user_authorization_levels ual
   WHERE ual.user_id = auth.uid() AND ual.current_level >= 3 AND ual.jurisdiction_country = afroloc_records.country))
  AND address_type = 'formal'
);

CREATE POLICY "Registered users can create records" ON public.afroloc_records
FOR INSERT WITH CHECK (auth.uid() = registered_by_user_id OR auth.uid() = user_id);

CREATE POLICY "Users can update address fields on their own records" ON public.afroloc_records
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own records" ON public.afroloc_records
FOR SELECT USING (auth.uid() = user_id);

-- Step 6: Drop old RLS policies for afroid_witnesses (now afroloc_witnesses)
DROP POLICY IF EXISTS "Users can be witnesses" ON public.afroloc_witnesses;
DROP POLICY IF EXISTS "Users can view witnesses for their records" ON public.afroloc_witnesses;
DROP POLICY IF EXISTS "Validators can update validation status" ON public.afroloc_witnesses;
DROP POLICY IF EXISTS "Validators can view requests for their jurisdiction" ON public.afroloc_witnesses;
DROP POLICY IF EXISTS "Witnesses can update their own confirmations" ON public.afroloc_witnesses;

-- Step 7: Recreate RLS policies for afroloc_witnesses
CREATE POLICY "Users can be witnesses" ON public.afroloc_witnesses
FOR INSERT WITH CHECK (auth.uid() = witness_user_id);

CREATE POLICY "Users can view witnesses for their records" ON public.afroloc_witnesses
FOR SELECT USING (
  EXISTS (SELECT 1 FROM afroloc_records WHERE afroloc_records.id = afroloc_witnesses.afroid_record_id AND afroloc_records.user_id = auth.uid())
  AND otp_code IS NULL
);

CREATE POLICY "Validators can update validation status" ON public.afroloc_witnesses
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM validation_phone_numbers vpn
    JOIN afroloc_records ar ON ar.id = afroloc_witnesses.afroid_record_id
    JOIN administrative_divisions ad ON ad.country_code = ar.country
      AND (ad.code = ar.level1_code OR ad.code = ar.level2_code OR ad.code = ar.level3_code OR ad.code = ar.level4_code)
    WHERE vpn.validator_user_id = auth.uid() AND vpn.administrative_division_id = ad.id
  )
);

CREATE POLICY "Validators can view requests for their jurisdiction" ON public.afroloc_witnesses
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM validation_phone_numbers vpn
    JOIN afroloc_records ar ON ar.id = afroloc_witnesses.afroid_record_id
    JOIN administrative_divisions ad ON ad.country_code = ar.country
      AND (ad.code = ar.level1_code OR ad.code = ar.level2_code OR ad.code = ar.level3_code OR ad.code = ar.level4_code)
    WHERE vpn.validator_user_id = auth.uid() AND vpn.administrative_division_id = ad.id AND afroloc_witnesses.status = 'pending'
  )
);

CREATE POLICY "Witnesses can update their own confirmations" ON public.afroloc_witnesses
FOR UPDATE USING (auth.uid() = witness_user_id);

-- Step 8: Drop old RLS policies for afroid_validations (now afroloc_validations)
DROP POLICY IF EXISTS "Admins can create validations" ON public.afroloc_validations;
DROP POLICY IF EXISTS "Users can view validations for their records" ON public.afroloc_validations;

-- Step 9: Recreate RLS policies for afroloc_validations
CREATE POLICY "Admins can create validations" ON public.afroloc_validations
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view validations for their records" ON public.afroloc_validations
FOR SELECT USING (
  EXISTS (SELECT 1 FROM afroloc_records WHERE afroloc_records.id = afroloc_validations.afroid_record_id AND afroloc_records.user_id = auth.uid())
);

-- Step 10: Update trigger function for verification date
CREATE OR REPLACE FUNCTION public.update_verification_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.next_verification_due := calculate_next_verification_date(
    NEW.last_verified_at,
    NEW.street_name,
    NEW.number
  );
  RETURN NEW;
END;
$function$;

-- Step 11: Update trigger function for GPS validation logging
CREATE OR REPLACE FUNCTION public.log_gps_validation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.geo_lat IS DISTINCT FROM OLD.geo_lat OR NEW.geo_lon IS DISTINCT FROM OLD.geo_lon)
     AND auth.uid() != NEW.user_id THEN
    NEW.gps_validated_at := now();
    NEW.gps_validated_by_user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;

-- Step 12: Update notify_validator_new_request function
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
  JOIN afroloc_records ar ON ar.id = NEW.afroid_record_id
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
        'afroloc_record_id', NEW.afroid_record_id
      ),
      'high'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Step 13: Update notify_requester_validation_completed function
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

-- Step 14: Update check_risk_alerts function
CREATE OR REPLACE FUNCTION public.check_risk_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_record RECORD;
  v_risk_score INTEGER;
BEGIN
  FOR v_record IN 
    SELECT 
      ar.*,
      p.user_id,
      p.phone,
      p.full_name,
      ras.high_risk_threshold,
      ras.critical_risk_threshold,
      ras.alert_type,
      ras.enabled
    FROM afroloc_records ar
    JOIN profiles p ON p.user_id = ar.user_id
    LEFT JOIN risk_alert_settings ras ON ras.user_id = p.user_id
    WHERE ras.enabled IS TRUE OR ras.enabled IS NULL
  LOOP
    v_risk_score := CASE
      WHEN v_record.next_verification_due < NOW() THEN 90
      WHEN v_record.next_verification_due < NOW() + INTERVAL '7 days' THEN 80
      WHEN v_record.street_name IS NULL OR v_record.number IS NULL THEN 70
      ELSE 30
    END;
    
    IF v_risk_score >= COALESCE(v_record.critical_risk_threshold, 85) THEN
      INSERT INTO risk_alerts_log (
        user_id, alert_type, risk_score, region_name, country_code, message, sent_via, metadata
      ) VALUES (
        v_record.user_id,
        'critical_risk',
        v_risk_score,
        v_record.level1_name,
        v_record.country,
        'Alerta Crítico: Score de risco ' || v_risk_score || ' para endereço ' || v_record.code,
        COALESCE(v_record.alert_type, 'email'),
        jsonb_build_object('afroloc_code', v_record.code, 'threshold', 'critical')
      );
    ELSIF v_risk_score >= COALESCE(v_record.high_risk_threshold, 75) THEN
      INSERT INTO risk_alerts_log (
        user_id, alert_type, risk_score, region_name, country_code, message, sent_via, metadata
      ) VALUES (
        v_record.user_id,
        'high_risk',
        v_risk_score,
        v_record.level1_name,
        v_record.country,
        'Alerta: Score de risco ' || v_risk_score || ' para endereço ' || v_record.code,
        COALESCE(v_record.alert_type, 'email'),
        jsonb_build_object('afroloc_code', v_record.code, 'threshold', 'high')
      );
    END IF;
  END LOOP;
END;
$function$;