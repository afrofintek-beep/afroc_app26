-- ================================================
-- WITNESS REPUTATION SYSTEM
-- Adds reputation scoring for witnesses to weight ATS calculations
-- Based on AFROLOC Operational Handbook Chapter 4
-- ================================================

-- Add reputation columns to afroloc_witnesses table
ALTER TABLE public.afroloc_witnesses
ADD COLUMN IF NOT EXISTS witness_reputation_score numeric DEFAULT 50.0 CHECK (witness_reputation_score >= 0 AND witness_reputation_score <= 100),
ADD COLUMN IF NOT EXISTS witness_reputation_updated_at timestamp with time zone DEFAULT now();

-- Create table to track witness history for reputation calculation
CREATE TABLE IF NOT EXISTS public.witness_reputation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  witness_user_id uuid NOT NULL,
  afroloc_record_id uuid REFERENCES public.afroloc_records(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('confirmation', 'rejection', 'validation', 'invalidation', 'fraud_flag')),
  score_change numeric NOT NULL DEFAULT 0,
  previous_score numeric NOT NULL,
  new_score numeric NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  created_by_user_id uuid
);

-- Enable RLS on witness_reputation_history
ALTER TABLE public.witness_reputation_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for witness_reputation_history
CREATE POLICY "Users can view their own reputation history"
ON public.witness_reputation_history
FOR SELECT
USING (auth.uid() = witness_user_id);

CREATE POLICY "Admins can view all reputation history"
ON public.witness_reputation_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert reputation history"
ON public.witness_reputation_history
FOR INSERT
WITH CHECK (true);

-- Create function to calculate witness reputation based on history
CREATE OR REPLACE FUNCTION public.calculate_witness_reputation(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_confirmations integer;
  v_validated_confirmations integer;
  v_rejected_confirmations integer;
  v_fraud_flags integer;
  v_reputation numeric;
  v_base_score numeric := 50.0;
  v_confirmation_bonus numeric := 2.0;
  v_validation_bonus numeric := 5.0;
  v_rejection_penalty numeric := 3.0;
  v_fraud_penalty numeric := 15.0;
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
  
  -- Count fraud flags from reputation history
  SELECT COUNT(*) INTO v_fraud_flags
  FROM public.witness_reputation_history
  WHERE witness_user_id = p_user_id AND action_type = 'fraud_flag';
  
  -- Calculate reputation score
  v_reputation := v_base_score
    + (v_total_confirmations * v_confirmation_bonus)
    + (v_validated_confirmations * v_validation_bonus)
    - (v_rejected_confirmations * v_rejection_penalty)
    - (v_fraud_flags * v_fraud_penalty);
  
  -- Clamp to 0-100 range
  v_reputation := GREATEST(0, LEAST(100, v_reputation));
  
  RETURN v_reputation;
END;
$$;

-- Create function to update witness reputation and log history
CREATE OR REPLACE FUNCTION public.update_witness_reputation(
  p_witness_user_id uuid,
  p_afroloc_record_id uuid,
  p_action_type text,
  p_reason text DEFAULT NULL,
  p_created_by_user_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_score numeric;
  v_new_score numeric;
  v_score_change numeric;
BEGIN
  -- Get previous score
  SELECT COALESCE(
    (SELECT witness_reputation_score FROM public.afroloc_witnesses 
     WHERE witness_user_id = p_witness_user_id LIMIT 1),
    50.0
  ) INTO v_previous_score;
  
  -- Calculate new reputation
  v_new_score := public.calculate_witness_reputation(p_witness_user_id);
  v_score_change := v_new_score - v_previous_score;
  
  -- Log the change
  INSERT INTO public.witness_reputation_history (
    witness_user_id,
    afroloc_record_id,
    action_type,
    score_change,
    previous_score,
    new_score,
    reason,
    created_by_user_id
  ) VALUES (
    p_witness_user_id,
    p_afroloc_record_id,
    p_action_type,
    v_score_change,
    v_previous_score,
    v_new_score,
    p_reason,
    p_created_by_user_id
  );
  
  -- Update all witness records for this user with new score
  UPDATE public.afroloc_witnesses
  SET 
    witness_reputation_score = v_new_score,
    witness_reputation_updated_at = now()
  WHERE witness_user_id = p_witness_user_id;
  
  RETURN v_new_score;
END;
$$;

-- Create function to get weighted witness score for ATS calculation
CREATE OR REPLACE FUNCTION public.get_weighted_witness_score(p_afroloc_record_id uuid)
RETURNS TABLE (
  total_witnesses integer,
  confirmed_witnesses integer,
  validated_witnesses integer,
  average_reputation numeric,
  weighted_score numeric,
  max_possible_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_confirmed integer;
  v_validated integer;
  v_avg_reputation numeric;
  v_weighted_score numeric;
  v_max_score numeric := 15.0; -- Max witness score in ATS
BEGIN
  -- Get witness counts
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'confirmed'),
    COUNT(*) FILTER (WHERE validated_at IS NOT NULL)
  INTO v_total, v_confirmed, v_validated
  FROM public.afroloc_witnesses
  WHERE afroloc_record_id = p_afroloc_record_id;
  
  -- Get average reputation of confirmed witnesses
  SELECT COALESCE(AVG(witness_reputation_score), 50.0)
  INTO v_avg_reputation
  FROM public.afroloc_witnesses
  WHERE afroloc_record_id = p_afroloc_record_id AND status = 'confirmed';
  
  -- Calculate weighted score
  -- Base: confirmed witnesses count * 2.5 (max 7.5 for 3+)
  -- Validation bonus: validated * 2.5 (max 5)
  -- Reputation multiplier: average_reputation / 100 (0.0 to 1.0)
  
  v_weighted_score := 0;
  
  IF v_confirmed >= 3 THEN
    v_weighted_score := 7.5;
  ELSIF v_confirmed >= 2 THEN
    v_weighted_score := 5.0;
  ELSIF v_confirmed >= 1 THEN
    v_weighted_score := 2.5;
  END IF;
  
  -- Add validation bonus
  v_weighted_score := v_weighted_score + LEAST(v_validated * 2.5, 5.0);
  
  -- Apply reputation multiplier (scales from 0.5 at 0 rep to 1.0 at 100 rep)
  v_weighted_score := v_weighted_score * (0.5 + (v_avg_reputation / 200.0));
  
  -- Cap at max score
  v_weighted_score := LEAST(v_weighted_score, v_max_score);
  
  RETURN QUERY SELECT 
    v_total::integer,
    v_confirmed::integer,
    v_validated::integer,
    v_avg_reputation,
    v_weighted_score,
    v_max_score;
END;
$$;

-- Trigger to update reputation when witness status changes
CREATE OR REPLACE FUNCTION public.trigger_update_witness_reputation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'confirmed' THEN
      PERFORM public.update_witness_reputation(
        NEW.witness_user_id,
        NEW.afroloc_record_id,
        'confirmation',
        'Witness confirmed address'
      );
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.update_witness_reputation(
        NEW.witness_user_id,
        NEW.afroloc_record_id,
        'rejection',
        COALESCE(NEW.rejection_reason, 'Witness rejected')
      );
    END IF;
  END IF;
  
  -- Check for validation
  IF OLD.validated_at IS NULL AND NEW.validated_at IS NOT NULL THEN
    PERFORM public.update_witness_reputation(
      NEW.witness_user_id,
      NEW.afroloc_record_id,
      'validation',
      'Witness officially validated'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_witness_status_change ON public.afroloc_witnesses;
CREATE TRIGGER on_witness_status_change
  AFTER UPDATE ON public.afroloc_witnesses
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_witness_reputation();

-- Initialize reputation scores for existing witnesses
UPDATE public.afroloc_witnesses w
SET witness_reputation_score = public.calculate_witness_reputation(w.witness_user_id),
    witness_reputation_updated_at = now()
WHERE witness_reputation_score IS NULL OR witness_reputation_score = 50.0;