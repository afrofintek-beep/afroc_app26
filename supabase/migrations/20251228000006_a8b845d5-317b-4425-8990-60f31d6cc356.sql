-- Fix authorization level recalculation so the "Criar Novo Afroloc" gate reflects profile + primary residence

CREATE OR REPLACE FUNCTION public.update_user_authorization_level(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_level integer;
  v_new_level integer;
  v_profile_complete boolean := false;
  v_has_primary boolean := false;
  v_computed_min_level integer := 1;
  v_full_name text;
  v_phone text;
  v_country text;
BEGIN
  -- Current level (if any)
  SELECT current_level
  INTO v_old_level
  FROM public.user_authorization_levels
  WHERE user_id = _user_id;

  -- Profile completeness (basic)
  SELECT full_name, phone, country
  INTO v_full_name, v_phone, v_country
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1;

  v_profile_complete :=
    COALESCE(NULLIF(TRIM(v_full_name), ''), NULL) IS NOT NULL
    AND COALESCE(NULLIF(TRIM(v_phone), ''), NULL) IS NOT NULL
    AND COALESCE(NULLIF(TRIM(v_country), ''), NULL) IS NOT NULL;

  -- Primary residence selected (and residential type)
  SELECT EXISTS (
    SELECT 1
    FROM public.afroloc_records r
    WHERE r.user_id = _user_id
      AND r.is_primary_residence IS TRUE
      AND (r.property_type = ANY (ARRAY['house','apartment']))
  )
  INTO v_has_primary;

  v_computed_min_level := CASE WHEN v_profile_complete AND v_has_primary THEN 2 ELSE 1 END;

  -- Never downgrade (avoid impacting admins/validators); only ensure minimum level is met.
  v_new_level := GREATEST(COALESCE(v_old_level, 1), v_computed_min_level);

  IF EXISTS (SELECT 1 FROM public.user_authorization_levels WHERE user_id = _user_id) THEN
    UPDATE public.user_authorization_levels
    SET current_level = v_new_level,
        updated_at = now()
    WHERE user_id = _user_id;
  ELSE
    INSERT INTO public.user_authorization_levels (user_id, current_level, created_at, updated_at)
    VALUES (_user_id, v_new_level, now(), now());
  END IF;

  -- Log change
  IF v_old_level IS DISTINCT FROM v_new_level THEN
    INSERT INTO public.security_audit_log (user_id, action, function_name, details)
    VALUES (
      _user_id,
      'authorization_level_change',
      'update_user_authorization_level',
      jsonb_build_object(
        'old_level', v_old_level,
        'new_level', v_new_level,
        'profile_complete', v_profile_complete,
        'has_primary_residence', v_has_primary,
        'changed_at', now()
      )
    );
  END IF;
END;
$$;

-- Trigger helper
CREATE OR REPLACE FUNCTION public.trigger_update_authorization_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.update_user_authorization_level(NEW.user_id);
  RETURN NEW;
END;
$$;

-- (Re)create triggers
DROP TRIGGER IF EXISTS on_profiles_update_authorization_level ON public.profiles;
CREATE TRIGGER on_profiles_update_authorization_level
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_authorization_level();

DROP TRIGGER IF EXISTS on_afroloc_records_update_authorization_level ON public.afroloc_records;
CREATE TRIGGER on_afroloc_records_update_authorization_level
AFTER INSERT OR UPDATE OF is_primary_residence, property_type, user_id ON public.afroloc_records
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_authorization_level();
