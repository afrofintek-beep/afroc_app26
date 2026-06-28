-- Create fraud flags table for witnesses
CREATE TABLE public.witness_fraud_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  witness_user_id UUID NOT NULL,
  afroloc_record_id UUID REFERENCES public.afroloc_records(id) ON DELETE SET NULL,
  flag_type TEXT NOT NULL, -- 'gps_spoofing', 'rapid_confirmations', 'cross_region', 'collusion', 'identity_mismatch'
  severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by_user_id UUID,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.witness_fraud_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own fraud flags"
  ON public.witness_fraud_flags
  FOR SELECT
  USING (auth.uid() = witness_user_id);

CREATE POLICY "Admins can view all fraud flags"
  ON public.witness_fraud_flags
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage fraud flags"
  ON public.witness_fraud_flags
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert fraud flags"
  ON public.witness_fraud_flags
  FOR INSERT
  WITH CHECK (true);

-- Create index for efficient queries
CREATE INDEX idx_witness_fraud_flags_user ON public.witness_fraud_flags(witness_user_id);
CREATE INDEX idx_witness_fraud_flags_type ON public.witness_fraud_flags(flag_type);
CREATE INDEX idx_witness_fraud_flags_unresolved ON public.witness_fraud_flags(witness_user_id) WHERE resolved = false;

-- Function to detect suspicious patterns and create fraud flags
CREATE OR REPLACE FUNCTION public.detect_witness_fraud_patterns(p_witness_user_id UUID, p_afroloc_record_id UUID)
RETURNS TABLE(
  flag_type TEXT,
  severity TEXT,
  description TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_confirmations_today INTEGER;
  v_confirmations_hour INTEGER;
  v_unique_regions INTEGER;
  v_avg_time_between INTERVAL;
  v_same_requester_count INTEGER;
  v_current_record RECORD;
BEGIN
  -- Get current record info
  SELECT * INTO v_current_record
  FROM afroloc_records
  WHERE id = p_afroloc_record_id;

  -- Pattern 1: Rapid confirmations (more than 5 in an hour)
  SELECT COUNT(*) INTO v_confirmations_hour
  FROM afroloc_witnesses
  WHERE witness_user_id = p_witness_user_id
    AND confirmed_at > NOW() - INTERVAL '1 hour';
  
  IF v_confirmations_hour >= 5 THEN
    RETURN QUERY SELECT 
      'rapid_confirmations'::TEXT,
      CASE WHEN v_confirmations_hour >= 10 THEN 'critical' ELSE 'high' END,
      format('Testemunha confirmou %s endereços na última hora', v_confirmations_hour),
      jsonb_build_object('confirmations_hour', v_confirmations_hour);
  END IF;

  -- Pattern 2: Too many confirmations per day (more than 15)
  SELECT COUNT(*) INTO v_confirmations_today
  FROM afroloc_witnesses
  WHERE witness_user_id = p_witness_user_id
    AND confirmed_at > CURRENT_DATE;
  
  IF v_confirmations_today >= 15 THEN
    RETURN QUERY SELECT 
      'rapid_confirmations'::TEXT,
      'high'::TEXT,
      format('Testemunha confirmou %s endereços hoje', v_confirmations_today),
      jsonb_build_object('confirmations_today', v_confirmations_today);
  END IF;

  -- Pattern 3: Cross-region witnessing (confirming in many different regions)
  SELECT COUNT(DISTINCT ar.level1_code) INTO v_unique_regions
  FROM afroloc_witnesses aw
  JOIN afroloc_records ar ON ar.id = aw.afroloc_record_id
  WHERE aw.witness_user_id = p_witness_user_id
    AND aw.confirmed_at > NOW() - INTERVAL '24 hours';
  
  IF v_unique_regions >= 3 THEN
    RETURN QUERY SELECT 
      'cross_region'::TEXT,
      'medium'::TEXT,
      format('Testemunha confirmou endereços em %s regiões diferentes em 24h', v_unique_regions),
      jsonb_build_object('unique_regions_24h', v_unique_regions);
  END IF;

  -- Pattern 4: Possible collusion (same witness for same requester multiple times)
  SELECT COUNT(*) INTO v_same_requester_count
  FROM afroloc_witnesses aw
  JOIN afroloc_records ar ON ar.id = aw.afroloc_record_id
  WHERE aw.witness_user_id = p_witness_user_id
    AND ar.user_id = v_current_record.user_id
    AND aw.status = 'confirmed';
  
  IF v_same_requester_count >= 3 THEN
    RETURN QUERY SELECT 
      'collusion'::TEXT,
      'high'::TEXT,
      format('Testemunha já confirmou %s endereços para o mesmo solicitante', v_same_requester_count),
      jsonb_build_object(
        'same_requester_confirmations', v_same_requester_count,
        'requester_user_id', v_current_record.user_id
      );
  END IF;

  RETURN;
END;
$$;

-- Function to create fraud flag and update reputation
CREATE OR REPLACE FUNCTION public.flag_witness_fraud(
  p_witness_user_id UUID,
  p_afroloc_record_id UUID,
  p_flag_type TEXT,
  p_severity TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_flag_id UUID;
  v_penalty NUMERIC;
BEGIN
  -- Insert the fraud flag
  INSERT INTO witness_fraud_flags (
    witness_user_id,
    afroloc_record_id,
    flag_type,
    severity,
    description,
    metadata
  ) VALUES (
    p_witness_user_id,
    p_afroloc_record_id,
    p_flag_type,
    p_severity,
    p_description,
    p_metadata
  )
  RETURNING id INTO v_flag_id;

  -- Calculate penalty based on severity
  v_penalty := CASE p_severity
    WHEN 'low' THEN -5
    WHEN 'medium' THEN -10
    WHEN 'high' THEN -15
    WHEN 'critical' THEN -25
    ELSE -10
  END;

  -- Update witness reputation with fraud flag
  PERFORM update_witness_reputation(
    p_witness_user_id,
    p_afroloc_record_id,
    'fraud_flag',
    format('%s: %s', p_flag_type, p_description),
    NULL
  );

  RETURN v_flag_id;
END;
$$;

-- Update calculate_witness_reputation to consider fraud flags
CREATE OR REPLACE FUNCTION public.calculate_witness_reputation(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_confirmations integer;
  v_validated_confirmations integer;
  v_rejected_confirmations integer;
  v_fraud_flags_active integer;
  v_fraud_flags_critical integer;
  v_reputation numeric;
  v_base_score numeric := 50.0;
  v_confirmation_bonus numeric := 2.0;
  v_validation_bonus numeric := 5.0;
  v_rejection_penalty numeric := 3.0;
  v_fraud_penalty numeric := 15.0;
  v_fraud_critical_penalty numeric := 25.0;
BEGIN
  -- Count confirmed witnesses by this user
  SELECT COUNT(*) INTO v_total_confirmations
  FROM public.afroloc_witnesses
  WHERE witness_user_id = p_user_id AND status = 'confirmed';
  
  -- Count validated witnesses (officially validated by authorities)
  SELECT COUNT(*) INTO v_validated_confirmations
  FROM public.afroloc_witnesses
  WHERE witness_user_id = p_user_id AND validated_at IS NOT NULL;
  
  -- Count rejected witnesses
  SELECT COUNT(*) INTO v_rejected_confirmations
  FROM public.afroloc_witnesses
  WHERE witness_user_id = p_user_id AND status = 'rejected';
  
  -- Count active fraud flags
  SELECT COUNT(*) INTO v_fraud_flags_active
  FROM public.witness_fraud_flags
  WHERE witness_user_id = p_user_id AND resolved = false;
  
  -- Count critical fraud flags
  SELECT COUNT(*) INTO v_fraud_flags_critical
  FROM public.witness_fraud_flags
  WHERE witness_user_id = p_user_id AND resolved = false AND severity = 'critical';
  
  -- Calculate reputation score
  v_reputation := v_base_score
    + (v_total_confirmations * v_confirmation_bonus)
    + (v_validated_confirmations * v_validation_bonus)
    - (v_rejected_confirmations * v_rejection_penalty)
    - (v_fraud_flags_active * v_fraud_penalty)
    - (v_fraud_flags_critical * v_fraud_critical_penalty);
  
  -- Clamp to 0-100 range
  v_reputation := GREATEST(0, LEAST(100, v_reputation));
  
  RETURN v_reputation;
END;
$$;

-- Trigger to auto-detect fraud patterns on witness confirmation
CREATE OR REPLACE FUNCTION public.trigger_detect_fraud_on_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pattern RECORD;
BEGIN
  -- Only check when status changes to confirmed
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    -- Detect fraud patterns
    FOR v_pattern IN 
      SELECT * FROM detect_witness_fraud_patterns(NEW.witness_user_id, NEW.afroloc_record_id)
    LOOP
      -- Create fraud flag for each detected pattern
      PERFORM flag_witness_fraud(
        NEW.witness_user_id,
        NEW.afroloc_record_id,
        v_pattern.flag_type,
        v_pattern.severity,
        v_pattern.description,
        v_pattern.metadata
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on afroloc_witnesses
DROP TRIGGER IF EXISTS on_witness_fraud_detection ON public.afroloc_witnesses;
CREATE TRIGGER on_witness_fraud_detection
  AFTER UPDATE ON public.afroloc_witnesses
  FOR EACH ROW
  EXECUTE FUNCTION trigger_detect_fraud_on_confirmation();