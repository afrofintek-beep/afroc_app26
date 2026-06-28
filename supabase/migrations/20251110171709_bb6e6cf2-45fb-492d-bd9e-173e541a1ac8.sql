-- Create user authorization levels table
CREATE TABLE IF NOT EXISTS public.user_authorization_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_level integer NOT NULL DEFAULT 1 CHECK (current_level >= 1 AND current_level <= 5),
  level_achieved_at timestamptz DEFAULT now(),
  witness_count integer DEFAULT 0,
  witness_success_rate numeric(5,2) DEFAULT 0,
  validation_count integer DEFAULT 0,
  account_age_days integer DEFAULT 0,
  afroid_count integer DEFAULT 0,
  last_evaluated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_authorization_levels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_authorization_levels
CREATE POLICY "Users can view their own authorization level"
ON public.user_authorization_levels
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all authorization levels"
ON public.user_authorization_levels
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert authorization levels"
ON public.user_authorization_levels
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update authorization levels"
ON public.user_authorization_levels
FOR UPDATE
USING (true);

CREATE POLICY "Admins can update authorization levels"
ON public.user_authorization_levels
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Function to calculate authorization level based on criteria
CREATE OR REPLACE FUNCTION public.calculate_user_authorization_level(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level integer := 1;
  v_witness_count integer := 0;
  v_validation_count integer := 0;
  v_account_age_days integer := 0;
  v_afroid_count integer := 0;
  v_profile_complete boolean := false;
  v_witness_success_rate numeric := 0;
  v_confirmed_witnesses integer := 0;
BEGIN
  -- Calculate account age in days
  SELECT EXTRACT(DAY FROM (now() - created_at))::integer
  INTO v_account_age_days
  FROM auth.users
  WHERE id = _user_id;

  -- Check if profile is complete
  SELECT 
    CASE 
      WHEN full_name IS NOT NULL 
        AND phone IS NOT NULL 
        AND country IS NOT NULL 
        AND city IS NOT NULL 
      THEN true 
      ELSE false 
    END
  INTO v_profile_complete
  FROM profiles
  WHERE user_id = _user_id;

  -- Count AFRO ID records
  SELECT COUNT(*)
  INTO v_afroid_count
  FROM afroid_records
  WHERE user_id = _user_id;

  -- Count confirmed witnesses for user's records
  SELECT COUNT(DISTINCT w.id)
  INTO v_confirmed_witnesses
  FROM afroid_witnesses w
  JOIN afroid_records r ON w.afroid_record_id = r.id
  WHERE r.user_id = _user_id 
    AND w.status = 'confirmed';

  -- Count times user has been a witness
  SELECT COUNT(*)
  INTO v_witness_count
  FROM afroid_witnesses
  WHERE witness_user_id = _user_id 
    AND status = 'confirmed';

  -- Calculate witness success rate
  IF v_witness_count > 0 THEN
    v_witness_success_rate := (v_witness_count::numeric / GREATEST(v_witness_count, 1)) * 100;
  END IF;

  -- Count validations received
  SELECT COUNT(DISTINCT v.id)
  INTO v_validation_count
  FROM afroid_validations v
  JOIN afroid_records r ON v.afroid_record_id = r.id
  WHERE r.user_id = _user_id;

  -- Determine level based on criteria
  -- Level 1: Basic (default - just registered)
  v_level := 1;

  -- Level 2: Verified (has AFRO ID + complete profile)
  IF v_afroid_count >= 1 AND v_profile_complete THEN
    v_level := 2;
  END IF;

  -- Level 3: Trusted (2+ confirmed witnesses + 7 days + complete profile)
  IF v_confirmed_witnesses >= 2 
     AND v_account_age_days >= 7 
     AND v_profile_complete THEN
    v_level := 3;
  END IF;

  -- Level 4: Certified (1+ validation + 3+ witness participations)
  IF v_validation_count >= 1 
     AND v_witness_count >= 3
     AND v_level >= 3 THEN
    v_level := 4;
  END IF;

  -- Level 5: Elite (3+ validations + 10+ witnesses + 90 days + 95%+ success rate)
  IF v_validation_count >= 3 
     AND v_witness_count >= 10
     AND v_account_age_days >= 90
     AND v_witness_success_rate >= 95
     AND v_level >= 4 THEN
    v_level := 5;
  END IF;

  RETURN v_level;
END;
$$;

-- Function to update user authorization level
CREATE OR REPLACE FUNCTION public.update_user_authorization_level(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_level integer;
  v_witness_count integer;
  v_validation_count integer;
  v_account_age_days integer;
  v_afroid_count integer;
  v_witness_success_rate numeric;
BEGIN
  -- Calculate new level
  v_new_level := calculate_user_authorization_level(_user_id);

  -- Get statistics
  SELECT COUNT(*) INTO v_witness_count
  FROM afroid_witnesses
  WHERE witness_user_id = _user_id AND status = 'confirmed';

  SELECT COUNT(DISTINCT v.id) INTO v_validation_count
  FROM afroid_validations v
  JOIN afroid_records r ON v.afroid_record_id = r.id
  WHERE r.user_id = _user_id;

  SELECT EXTRACT(DAY FROM (now() - created_at))::integer INTO v_account_age_days
  FROM auth.users
  WHERE id = _user_id;

  SELECT COUNT(*) INTO v_afroid_count
  FROM afroid_records
  WHERE user_id = _user_id;

  v_witness_success_rate := CASE 
    WHEN v_witness_count > 0 THEN (v_witness_count::numeric / GREATEST(v_witness_count, 1)) * 100
    ELSE 0
  END;

  -- Insert or update authorization level
  INSERT INTO user_authorization_levels (
    user_id,
    current_level,
    level_achieved_at,
    witness_count,
    witness_success_rate,
    validation_count,
    account_age_days,
    afroid_count,
    last_evaluated_at,
    updated_at
  )
  VALUES (
    _user_id,
    v_new_level,
    now(),
    v_witness_count,
    v_witness_success_rate,
    v_validation_count,
    v_account_age_days,
    v_afroid_count,
    now(),
    now()
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    current_level = v_new_level,
    level_achieved_at = CASE 
      WHEN user_authorization_levels.current_level != v_new_level THEN now()
      ELSE user_authorization_levels.level_achieved_at
    END,
    witness_count = v_witness_count,
    witness_success_rate = v_witness_success_rate,
    validation_count = v_validation_count,
    account_age_days = v_account_age_days,
    afroid_count = v_afroid_count,
    last_evaluated_at = now(),
    updated_at = now();
END;
$$;

-- Trigger to auto-update authorization level when profiles are updated
CREATE OR REPLACE FUNCTION public.trigger_update_authorization_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM update_user_authorization_level(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_updated
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION trigger_update_authorization_level();

-- Trigger for AFRO ID records
CREATE TRIGGER on_afroid_record_updated
AFTER INSERT OR UPDATE ON public.afroid_records
FOR EACH ROW
EXECUTE FUNCTION trigger_update_authorization_level();

-- Trigger for witnesses
CREATE OR REPLACE FUNCTION public.trigger_update_witness_authorization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update level for the witness user
  PERFORM update_user_authorization_level(NEW.witness_user_id);
  
  -- Update level for the record owner
  PERFORM update_user_authorization_level(
    (SELECT user_id FROM afroid_records WHERE id = NEW.afroid_record_id)
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_witness_updated
AFTER INSERT OR UPDATE ON public.afroid_witnesses
FOR EACH ROW
EXECUTE FUNCTION trigger_update_witness_authorization();

-- Trigger for validations
CREATE OR REPLACE FUNCTION public.trigger_update_validation_authorization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update level for the record owner
  PERFORM update_user_authorization_level(
    (SELECT user_id FROM afroid_records WHERE id = NEW.afroid_record_id)
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_validation_created
AFTER INSERT ON public.afroid_validations
FOR EACH ROW
EXECUTE FUNCTION trigger_update_validation_authorization();

-- Function to check if user has minimum level (for RLS policies)
CREATE OR REPLACE FUNCTION public.has_min_level(_user_id uuid, _min_level integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_authorization_levels
    WHERE user_id = _user_id
      AND current_level >= _min_level
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.user_authorization_levels
    WHERE user_id = _user_id
  );
$$;

-- Update trigger on user_authorization_levels
CREATE TRIGGER update_user_authorization_levels_updated_at
BEFORE UPDATE ON public.user_authorization_levels
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Initialize authorization levels for existing users
INSERT INTO user_authorization_levels (user_id, current_level)
SELECT id, 1
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_authorization_levels)
ON CONFLICT (user_id) DO NOTHING;