
-- Zone resolver function using polygon containment
CREATE OR REPLACE FUNCTION public.resolve_zone_by_polygon(
  p_lon NUMERIC,
  p_lat NUMERIC
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM urban_zones
    WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326))
    LIMIT 1
  );
$$;

-- Full zone resolver with fallback
CREATE OR REPLACE FUNCTION public.resolve_zone(
  p_lon NUMERIC,
  p_lat NUMERIC,
  p_admin_path TEXT DEFAULT NULL,
  p_explicit_zone TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_urban_keywords TEXT[] := ARRAY[
    'LUANDA', 'TALATONA', 'VIANA', 'CAZENGA', 'BELAS', 'KILAMBA',
    'BENGUELA', 'LOBITO', 'HUAMBO', 'CABINDA', 'LUBANGO',
    'MALANJE', 'NAMIBE', 'SOYO', 'UIGE', 'SUMBE'
  ];
  v_admin_upper TEXT;
  v_keyword TEXT;
BEGIN
  -- 1. Explicit override
  IF p_explicit_zone IS NOT NULL AND LOWER(p_explicit_zone) IN ('urban', 'rural') THEN
    RETURN LOWER(p_explicit_zone);
  END IF;
  
  -- 2. Polygon truth (PostGIS containment check)
  IF resolve_zone_by_polygon(p_lon, p_lat) THEN
    RETURN 'urban';
  END IF;
  
  -- 3. Keyword fallback
  IF p_admin_path IS NOT NULL THEN
    v_admin_upper := UPPER(p_admin_path);
    FOREACH v_keyword IN ARRAY v_urban_keywords
    LOOP
      IF v_admin_upper LIKE '%' || v_keyword || '%' THEN
        RETURN 'urban';
      END IF;
    END LOOP;
  END IF;
  
  -- 4. Default to rural
  RETURN 'rural';
END;
$$;
