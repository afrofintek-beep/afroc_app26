
-- =============================================
-- AFROLOC ADDRESS VERSIONING
-- =============================================

-- 1. Versions table — stores snapshot of each change
CREATE TABLE public.afroloc_record_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id UUID NOT NULL REFERENCES public.afroloc_records(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL,
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  changed_by_user_id UUID,
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX idx_versions_record ON public.afroloc_record_versions(record_id);
CREATE INDEX idx_versions_record_version ON public.afroloc_record_versions(record_id, version DESC);
CREATE INDEX idx_versions_created ON public.afroloc_record_versions(created_at DESC);

-- 3. Unique constraint: one version number per record
ALTER TABLE public.afroloc_record_versions
  ADD CONSTRAINT uq_record_version UNIQUE (record_id, version);

-- 4. RLS
ALTER TABLE public.afroloc_record_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions of their own records"
  ON public.afroloc_record_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.afroloc_records
      WHERE id = afroloc_record_versions.record_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all versions"
  ON public.afroloc_record_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_authorization_levels
      WHERE user_id = auth.uid() AND current_level >= 4
    )
  );

-- 5. Trigger function: auto-snapshot on update
CREATE OR REPLACE FUNCTION public.version_afroloc_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_version INTEGER;
  changed TEXT[] := '{}';
BEGIN
  -- Calculate next version
  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM public.afroloc_record_versions
  WHERE record_id = OLD.id;

  -- Detect changed fields
  IF OLD.code IS DISTINCT FROM NEW.code THEN changed := changed || 'code'; END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN changed := changed || 'status'; END IF;
  IF OLD.geo_lat IS DISTINCT FROM NEW.geo_lat THEN changed := changed || 'geo_lat'; END IF;
  IF OLD.geo_lon IS DISTINCT FROM NEW.geo_lon THEN changed := changed || 'geo_lon'; END IF;
  IF OLD.level1_name IS DISTINCT FROM NEW.level1_name THEN changed := changed || 'level1_name'; END IF;
  IF OLD.level2_name IS DISTINCT FROM NEW.level2_name THEN changed := changed || 'level2_name'; END IF;
  IF OLD.level3_name IS DISTINCT FROM NEW.level3_name THEN changed := changed || 'level3_name'; END IF;
  IF OLD.level4_name IS DISTINCT FROM NEW.level4_name THEN changed := changed || 'level4_name'; END IF;
  IF OLD.street_name IS DISTINCT FROM NEW.street_name THEN changed := changed || 'street_name'; END IF;
  IF OLD.number IS DISTINCT FROM NEW.number THEN changed := changed || 'number'; END IF;
  IF OLD.unit IS DISTINCT FROM NEW.unit THEN changed := changed || 'unit'; END IF;
  IF OLD.property_type IS DISTINCT FROM NEW.property_type THEN changed := changed || 'property_type'; END IF;
  IF OLD.address_type IS DISTINCT FROM NEW.address_type THEN changed := changed || 'address_type'; END IF;

  -- Only create version if something meaningful changed
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
$$;

-- 6. Attach trigger
CREATE TRIGGER trg_version_afroloc_record
  BEFORE UPDATE ON public.afroloc_records
  FOR EACH ROW
  EXECUTE FUNCTION public.version_afroloc_record();
