-- Create table for cadastral grid cells generated in batch
CREATE TABLE public.cadastral_grid_cells (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- AFROLOC Code
  afroloc_code TEXT NOT NULL UNIQUE,
  
  -- Zone Information
  zone_type TEXT NOT NULL CHECK (zone_type IN ('urban', 'rural')),
  cell_size_meters INTEGER NOT NULL,
  
  -- Geographic Coordinates
  centroid_lat NUMERIC NOT NULL,
  centroid_lon NUMERIC NOT NULL,
  min_lat NUMERIC NOT NULL,
  max_lat NUMERIC NOT NULL,
  min_lon NUMERIC NOT NULL,
  max_lon NUMERIC NOT NULL,
  
  -- Administrative Division (matches afroloc_records structure)
  country_code TEXT NOT NULL,
  level1_code TEXT,
  level1_name TEXT,
  level2_code TEXT,
  level2_name TEXT,
  level3_code TEXT,
  level3_name TEXT,
  level4_code TEXT,
  level4_name TEXT,
  
  -- Generation Metadata
  generated_by_user_id UUID NOT NULL,
  generation_method TEXT NOT NULL DEFAULT 'batch_map' CHECK (generation_method IN ('batch_map', 'single', 'import', 'automatic')),
  batch_id UUID,
  
  -- Property/Land Use Information
  land_use_type TEXT CHECK (land_use_type IN ('residential', 'commercial', 'industrial', 'agricultural', 'mixed', 'vacant', 'public', 'unknown')),
  estimated_parcels INTEGER,
  notes TEXT,
  
  -- Status and Approval Workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'mapped', 'deprecated')),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by_user_id UUID,
  rejection_reason TEXT,
  
  -- Statistics
  certification_count INTEGER DEFAULT 0,
  last_certification_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_cadastral_cells_country ON public.cadastral_grid_cells(country_code);
CREATE INDEX idx_cadastral_cells_status ON public.cadastral_grid_cells(status);
CREATE INDEX idx_cadastral_cells_level1 ON public.cadastral_grid_cells(country_code, level1_code);
CREATE INDEX idx_cadastral_cells_level2 ON public.cadastral_grid_cells(country_code, level1_code, level2_code);
CREATE INDEX idx_cadastral_cells_generated_by ON public.cadastral_grid_cells(generated_by_user_id);
CREATE INDEX idx_cadastral_cells_centroid ON public.cadastral_grid_cells(centroid_lat, centroid_lon);

-- Spatial index for geographic queries (bounding box)
CREATE INDEX idx_cadastral_cells_bbox ON public.cadastral_grid_cells(min_lat, max_lat, min_lon, max_lon);

-- Enable Row Level Security
ALTER TABLE public.cadastral_grid_cells ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Anyone can view approved cells (public cadastral data)
CREATE POLICY "Anyone can view approved cadastral cells"
ON public.cadastral_grid_cells
FOR SELECT
USING (status = 'approved' OR status = 'mapped');

-- Authenticated users can view all cells in their jurisdiction
CREATE POLICY "Validators can view cells in their jurisdiction"
ON public.cadastral_grid_cells
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM validation_phone_numbers vpn
    JOIN administrative_divisions ad ON vpn.administrative_division_id = ad.id
    WHERE vpn.validator_user_id = auth.uid()
    AND ad.country_code = cadastral_grid_cells.country_code
    AND (ad.code = cadastral_grid_cells.level1_code 
         OR ad.code = cadastral_grid_cells.level2_code 
         OR ad.code = cadastral_grid_cells.level3_code
         OR ad.code = cadastral_grid_cells.level4_code)
  )
);

-- Users can view cells they generated
CREATE POLICY "Users can view cells they generated"
ON public.cadastral_grid_cells
FOR SELECT
USING (auth.uid() = generated_by_user_id);

-- Authenticated users can insert cells
CREATE POLICY "Authenticated users can generate cadastral cells"
ON public.cadastral_grid_cells
FOR INSERT
WITH CHECK (auth.uid() = generated_by_user_id);

-- Validators can approve/reject cells in their jurisdiction
CREATE POLICY "Validators can update cells in their jurisdiction"
ON public.cadastral_grid_cells
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM validation_phone_numbers vpn
    JOIN administrative_divisions ad ON vpn.administrative_division_id = ad.id
    WHERE vpn.validator_user_id = auth.uid()
    AND ad.country_code = cadastral_grid_cells.country_code
    AND (ad.code = cadastral_grid_cells.level1_code 
         OR ad.code = cadastral_grid_cells.level2_code 
         OR ad.code = cadastral_grid_cells.level3_code
         OR ad.code = cadastral_grid_cells.level4_code)
  )
);

-- Admins have full access
CREATE POLICY "Admins can manage all cadastral cells"
ON public.cadastral_grid_cells
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_cadastral_cells_updated_at
BEFORE UPDATE ON public.cadastral_grid_cells
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for batch generation history
CREATE TABLE public.cadastral_batch_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Batch Information
  generated_by_user_id UUID NOT NULL,
  country_code TEXT NOT NULL,
  
  -- Area covered
  min_lat NUMERIC NOT NULL,
  max_lat NUMERIC NOT NULL,
  min_lon NUMERIC NOT NULL,
  max_lon NUMERIC NOT NULL,
  
  -- Statistics
  total_cells_generated INTEGER NOT NULL DEFAULT 0,
  urban_cells_count INTEGER DEFAULT 0,
  rural_cells_count INTEGER DEFAULT 0,
  area_hectares NUMERIC,
  
  -- Administrative context
  level1_code TEXT,
  level1_name TEXT,
  level2_code TEXT,
  level2_name TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'failed', 'cancelled')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for batch generations
ALTER TABLE public.cadastral_batch_generations ENABLE ROW LEVEL SECURITY;

-- Users can view their own batch generations
CREATE POLICY "Users can view own batch generations"
ON public.cadastral_batch_generations
FOR SELECT
USING (auth.uid() = generated_by_user_id);

-- Users can insert their own batch generations
CREATE POLICY "Users can create batch generations"
ON public.cadastral_batch_generations
FOR INSERT
WITH CHECK (auth.uid() = generated_by_user_id);

-- Admins can view all batch generations
CREATE POLICY "Admins can view all batch generations"
ON public.cadastral_batch_generations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));