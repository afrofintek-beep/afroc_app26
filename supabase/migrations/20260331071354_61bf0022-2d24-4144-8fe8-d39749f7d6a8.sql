-- Add missing geo indexes for spatial query performance

-- 1. afroloc_records: most queried geo table, needs composite index
CREATE INDEX IF NOT EXISTS idx_afroloc_records_geo
  ON public.afroloc_records (geo_lat, geo_lon)
  WHERE geo_lat IS NOT NULL AND geo_lon IS NOT NULL;

-- 2. afroloc_records: country + status for filtered dashboard queries
CREATE INDEX IF NOT EXISTS idx_afroloc_records_country_status
  ON public.afroloc_records (country, status);

-- 3. afroloc_gps_history: spatial lookups for proximity validation
CREATE INDEX IF NOT EXISTS idx_gps_history_coords
  ON public.afroloc_gps_history (new_lat, new_lon);

-- 4. afroloc_gps_history: record lookup (frequent join)
CREATE INDEX IF NOT EXISTS idx_gps_history_record_id
  ON public.afroloc_gps_history (afroloc_record_id, created_at DESC);

-- 5. afroloc_checkins: proximity validation queries
CREATE INDEX IF NOT EXISTS idx_checkins_geo
  ON public.afroloc_checkins (geo_lat, geo_lon);

-- 6. afroloc_checkins: record + time for streak calculations
CREATE INDEX IF NOT EXISTS idx_checkins_record_time
  ON public.afroloc_checkins (afroloc_record_id, checked_in_at DESC);

-- 7. afroloc_requests: geo for map views
CREATE INDEX IF NOT EXISTS idx_requests_geo
  ON public.afroloc_requests (geo_lat, geo_lon)
  WHERE geo_lat IS NOT NULL AND geo_lon IS NOT NULL;

-- 8. cadastral_protected_zones: bbox for intersection checks
CREATE INDEX IF NOT EXISTS idx_protected_zones_bbox
  ON public.cadastral_protected_zones (min_lat, max_lat, min_lon, max_lon)
  WHERE is_active = true;