
-- Cell density cache for adaptive SQ subdivision
CREATE TABLE public.cell_density_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  afroloc_code TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'AO',
  zone TEXT NOT NULL CHECK (zone IN ('urban', 'rural')),
  grid_m INTEGER NOT NULL,
  tile_ix INTEGER NOT NULL,
  tile_iy INTEGER NOT NULL,
  certification_count INTEGER NOT NULL DEFAULT 0,
  estimated_population INTEGER NOT NULL DEFAULT 0,
  density_class TEXT NOT NULL DEFAULT 'low' CHECK (density_class IN ('low', 'medium', 'high', 'very_high')),
  subdivision_type TEXT NOT NULL DEFAULT '2x2' CHECK (subdivision_type IN ('2x2', '3x3', '4x4', '5x5')),
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  calculation_window_days INTEGER NOT NULL DEFAULT 30,
  growth_rate_percent NUMERIC(5,2) DEFAULT 0,
  previous_density_class TEXT,
  promoted_at TIMESTAMPTZ,
  bbox_min_lat NUMERIC(10,6),
  bbox_min_lon NUMERIC(10,6),
  bbox_max_lat NUMERIC(10,6),
  bbox_max_lon NUMERIC(10,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(afroloc_code)
);

-- Index for fast lookups
CREATE INDEX idx_cell_density_code ON public.cell_density_cache(afroloc_code);
CREATE INDEX idx_cell_density_country ON public.cell_density_cache(country_code, density_class);
CREATE INDEX idx_cell_density_geo ON public.cell_density_cache(bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon);

-- Density history for temporal analysis
CREATE TABLE public.cell_density_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  afroloc_code TEXT NOT NULL,
  certification_count INTEGER NOT NULL,
  density_class TEXT NOT NULL,
  subdivision_type TEXT NOT NULL,
  growth_rate_percent NUMERIC(5,2) DEFAULT 0,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_density_history_code ON public.cell_density_history(afroloc_code, snapshot_at DESC);

-- Enable RLS
ALTER TABLE public.cell_density_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cell_density_history ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated users
CREATE POLICY "Authenticated users can read density cache"
  ON public.cell_density_cache FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read density history"
  ON public.cell_density_history FOR SELECT TO authenticated USING (true);

-- Only admins can write (via edge functions using service role)
-- No INSERT/UPDATE/DELETE policies for regular users — service role bypasses RLS

-- Timestamp trigger
CREATE TRIGGER update_cell_density_cache_updated_at
  BEFORE UPDATE ON public.cell_density_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
