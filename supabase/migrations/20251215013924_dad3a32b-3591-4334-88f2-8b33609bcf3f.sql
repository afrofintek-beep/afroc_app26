
-- Function to import a single urban zone from GeoJSON
CREATE OR REPLACE FUNCTION public.import_urban_zone(
  p_name TEXT,
  p_admin_path TEXT,
  p_source TEXT,
  p_geojson TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_geom geometry;
  v_id INTEGER;
BEGIN
  -- Parse GeoJSON and convert to geometry
  v_geom := ST_GeomFromGeoJSON(p_geojson);
  
  -- Ensure valid geometry and convert to MULTIPOLYGON
  v_geom := ST_Multi(ST_MakeValid(v_geom));
  
  -- Set SRID to 4326 (WGS84)
  v_geom := ST_SetSRID(v_geom, 4326);
  
  -- Insert into urban_zones
  INSERT INTO public.urban_zones (name, admin_path, source, geom)
  VALUES (
    COALESCE(p_name, 'Urban Zone'),
    COALESCE(p_admin_path, ''),
    COALESCE(p_source, 'geojson'),
    v_geom
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Function to bulk import urban zones from GeoJSON features array
CREATE OR REPLACE FUNCTION public.import_urban_zones_bulk(
  p_features JSONB,
  p_source TEXT DEFAULT 'geojson'
)
RETURNS TABLE(imported_id INTEGER, feature_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_feature JSONB;
  v_geom geometry;
  v_name TEXT;
  v_admin_path TEXT;
  v_id INTEGER;
BEGIN
  FOR v_feature IN SELECT * FROM jsonb_array_elements(p_features)
  LOOP
    -- Extract properties
    v_name := COALESCE(
      v_feature->'properties'->>'name',
      v_feature->'properties'->>'NAME',
      'Urban Zone'
    );
    v_admin_path := COALESCE(
      v_feature->'properties'->>'admin_path',
      v_feature->'properties'->>'ADM_PATH',
      v_feature->'properties'->>'ADMIN',
      ''
    );
    
    -- Parse geometry from GeoJSON
    v_geom := ST_GeomFromGeoJSON(v_feature->'geometry');
    
    -- Ensure valid MULTIPOLYGON with correct SRID
    v_geom := ST_SetSRID(ST_Multi(ST_MakeValid(v_geom)), 4326);
    
    -- Skip if geometry is not valid polygon type
    IF GeometryType(v_geom) NOT IN ('MULTIPOLYGON', 'POLYGON') THEN
      CONTINUE;
    END IF;
    
    -- Insert and get ID
    INSERT INTO public.urban_zones (name, admin_path, source, geom)
    VALUES (v_name, v_admin_path, p_source, v_geom)
    RETURNING id INTO v_id;
    
    -- Return result row
    imported_id := v_id;
    feature_name := v_name;
    RETURN NEXT;
  END LOOP;
END;
$$;
