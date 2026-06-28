-- 1. Create archive table for old GPS history
CREATE TABLE IF NOT EXISTS public.afroloc_gps_history_archive (
  LIKE public.afroloc_gps_history INCLUDING ALL
);

-- 2. Add archival metadata
ALTER TABLE public.afroloc_gps_history_archive 
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NOT NULL DEFAULT now();

-- 3. Enable RLS on archive table
ALTER TABLE public.afroloc_gps_history_archive ENABLE ROW LEVEL SECURITY;

-- 4. RLS: only admins can read archive
CREATE POLICY "Admins can read GPS archive"
  ON public.afroloc_gps_history_archive
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Create archival function: moves records older than 90 days
CREATE OR REPLACE FUNCTION public.archive_old_gps_history(retention_days int DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff_date timestamptz;
  archived_count int;
BEGIN
  cutoff_date := now() - (retention_days || ' days')::interval;

  -- Copy old records to archive
  WITH moved AS (
    INSERT INTO public.afroloc_gps_history_archive (
      id, afroloc_record_id, user_id,
      previous_lat, previous_lon, new_lat, new_lon,
      distance_meters, accuracy_meters, update_reason,
      photo_path, device_info, created_at, archived_at
    )
    SELECT
      id, afroloc_record_id, user_id,
      previous_lat, previous_lon, new_lat, new_lon,
      distance_meters, accuracy_meters, update_reason,
      photo_path, device_info, created_at, now()
    FROM public.afroloc_gps_history
    WHERE created_at < cutoff_date
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO archived_count FROM moved;

  -- Delete archived records from main table
  DELETE FROM public.afroloc_gps_history
  WHERE created_at < cutoff_date
    AND id IN (SELECT id FROM public.afroloc_gps_history_archive);

  RETURN jsonb_build_object(
    'archived_count', archived_count,
    'cutoff_date', cutoff_date,
    'retention_days', retention_days
  );
END;
$$;

-- 6. Create index for efficient archival queries
CREATE INDEX IF NOT EXISTS idx_gps_history_created_at 
  ON public.afroloc_gps_history (created_at);