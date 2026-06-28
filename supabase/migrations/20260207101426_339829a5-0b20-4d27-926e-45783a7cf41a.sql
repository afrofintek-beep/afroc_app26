CREATE OR REPLACE FUNCTION public.version_afroloc_record()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
  changed TEXT[] := '{}';
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM public.afroloc_record_versions
  WHERE record_id = OLD.id;

  IF OLD.code IS DISTINCT FROM NEW.code THEN changed := changed || ARRAY['code']; END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN changed := changed || ARRAY['status']; END IF;
  IF OLD.geo_lat IS DISTINCT FROM NEW.geo_lat THEN changed := changed || ARRAY['geo_lat']; END IF;
  IF OLD.geo_lon IS DISTINCT FROM NEW.geo_lon THEN changed := changed || ARRAY['geo_lon']; END IF;
  IF OLD.level1_name IS DISTINCT FROM NEW.level1_name THEN changed := changed || ARRAY['level1_name']; END IF;
  IF OLD.level2_name IS DISTINCT FROM NEW.level2_name THEN changed := changed || ARRAY['level2_name']; END IF;
  IF OLD.level3_name IS DISTINCT FROM NEW.level3_name THEN changed := changed || ARRAY['level3_name']; END IF;
  IF OLD.level4_name IS DISTINCT FROM NEW.level4_name THEN changed := changed || ARRAY['level4_name']; END IF;
  IF OLD.street_name IS DISTINCT FROM NEW.street_name THEN changed := changed || ARRAY['street_name']; END IF;
  IF OLD.number IS DISTINCT FROM NEW.number THEN changed := changed || ARRAY['number']; END IF;
  IF OLD.unit IS DISTINCT FROM NEW.unit THEN changed := changed || ARRAY['unit']; END IF;
  IF OLD.property_type IS DISTINCT FROM NEW.property_type THEN changed := changed || ARRAY['property_type']; END IF;
  IF OLD.address_type IS DISTINCT FROM NEW.address_type THEN changed := changed || ARRAY['address_type']; END IF;

  IF array_length(changed, 1) > 0 THEN
    INSERT INTO public.afroloc_record_versions (record_id, version, snapshot, changed_fields, changed_by_user_id)
    VALUES (
      OLD.id,
      next_version,
      to_jsonb(OLD),
      changed,
      NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;