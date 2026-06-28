-- Create function to import urban zone from GeoJSON
CREATE OR REPLACE FUNCTION public.import_urban_zone(
  p_name TEXT,
  p_admin_path TEXT,
  p_source TEXT,
  p_geojson TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id INTEGER;
BEGIN
  INSERT INTO public.urban_zones (name, admin_path, source, geom)
  VALUES (
    COALESCE(p_name, 'Urban Zone'),
    COALESCE(p_admin_path, ''),
    COALESCE(p_source, 'geojson'),
    ST_Multi(ST_GeomFromGeoJSON(p_geojson))
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Create bulk import function for FeatureCollection
CREATE OR REPLACE FUNCTION public.import_urban_zones_bulk(
  p_features JSONB,
  p_source TEXT DEFAULT 'geojson'
)
RETURNS TABLE(imported_id INTEGER, feature_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feature JSONB;
  v_name TEXT;
  v_admin_path TEXT;
  v_geom_json TEXT;
  v_id INTEGER;
BEGIN
  FOR v_feature IN SELECT jsonb_array_elements(p_features)
  LOOP
    v_name := COALESCE(v_feature->'properties'->>'name', v_feature->'properties'->>'NAME', 'Urban Zone');
    v_admin_path := COALESCE(v_feature->'properties'->>'admin_path', v_feature->'properties'->>'ADM_PATH', '');
    v_geom_json := (v_feature->'geometry')::TEXT;
    
    INSERT INTO public.urban_zones (name, admin_path, source, geom)
    VALUES (
      v_name,
      v_admin_path,
      p_source,
      ST_Multi(ST_GeomFromGeoJSON(v_geom_json))
    )
    RETURNING id INTO v_id;
    
    imported_id := v_id;
    feature_name := v_name;
    RETURN NEXT;
  END LOOP;
END;
$$;