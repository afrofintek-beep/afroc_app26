
-- Function to get urban zones status for admin dashboard
CREATE OR REPLACE FUNCTION public.get_urban_zones_status()
RETURNS JSON
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'zones', COUNT(*)::bigint,
    'invalid', COUNT(*) FILTER (WHERE NOT ST_IsValid(geom))::bigint,
    'total_area_km2', ROUND((SUM(ST_Area(geom::geography)) / 1000000)::numeric, 2)
  )
  FROM urban_zones;
$$;
