-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create urban_zones table with PostGIS geometry
CREATE TABLE IF NOT EXISTS public.urban_zones (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Urban Zone',
  admin_path TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'geojson',
  geom geometry(MULTIPOLYGON, 4326) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create spatial index for geometry queries
CREATE INDEX IF NOT EXISTS ix_urban_zones_geom_gist ON public.urban_zones USING GIST (geom);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS ix_urban_zones_admin ON public.urban_zones(admin_path);
CREATE INDEX IF NOT EXISTS ix_urban_zones_source ON public.urban_zones(source);

-- Enable Row Level Security
ALTER TABLE public.urban_zones ENABLE ROW LEVEL SECURITY;

-- Public read access for urban zones (needed for zone detection)
CREATE POLICY "Anyone can view urban zones"
ON public.urban_zones
FOR SELECT
USING (true);

-- Only admins can manage urban zones
CREATE POLICY "Admins can manage urban zones"
ON public.urban_zones
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));