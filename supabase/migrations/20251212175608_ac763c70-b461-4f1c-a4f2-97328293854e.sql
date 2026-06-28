-- Create cell_towers table for real telecom integration
CREATE TABLE public.cell_towers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telecom_operator_id UUID REFERENCES public.telecom_operators(id) ON DELETE SET NULL,
  
  -- Cell identifiers
  cell_id TEXT NOT NULL,
  lac INTEGER, -- Location Area Code (2G/3G)
  tac INTEGER, -- Tracking Area Code (4G/5G)
  mcc TEXT NOT NULL, -- Mobile Country Code
  mnc TEXT NOT NULL, -- Mobile Network Code
  
  -- Location
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  altitude_meters NUMERIC(6, 2),
  
  -- Technical specifications
  technology TEXT NOT NULL CHECK (technology IN ('2G', '3G', '4G', '5G')),
  frequency_band TEXT,
  coverage_radius_meters INTEGER DEFAULT 1000,
  azimuth_degrees INTEGER CHECK (azimuth_degrees >= 0 AND azimuth_degrees < 360),
  antenna_height_meters NUMERIC(5, 2),
  
  -- Signal characteristics (for trilateration calculations)
  max_rsrp NUMERIC(5, 2) DEFAULT -44, -- Maximum Reference Signal Received Power
  path_loss_exponent NUMERIC(3, 2) DEFAULT 3.5, -- For distance estimation formula
  
  -- Administrative
  country_code TEXT NOT NULL,
  level1_code TEXT,
  level1_name TEXT,
  level2_code TEXT,
  level2_name TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  verified_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint on cell identification
  CONSTRAINT unique_cell_tower UNIQUE (mcc, mnc, lac, tac, cell_id)
);

-- Create indexes for efficient queries
CREATE INDEX idx_cell_towers_location ON public.cell_towers USING btree (latitude, longitude);
CREATE INDEX idx_cell_towers_country ON public.cell_towers (country_code);
CREATE INDEX idx_cell_towers_operator ON public.cell_towers (telecom_operator_id);
CREATE INDEX idx_cell_towers_technology ON public.cell_towers (technology);
CREATE INDEX idx_cell_towers_active ON public.cell_towers (is_active) WHERE is_active = true;

-- Spatial index using coordinate box (for nearby tower queries)
CREATE INDEX idx_cell_towers_geo_box ON public.cell_towers (
  (latitude - (coverage_radius_meters::numeric / 111000)),
  (latitude + (coverage_radius_meters::numeric / 111000)),
  (longitude - (coverage_radius_meters::numeric / (111000 * cos(radians(latitude))))),
  (longitude + (coverage_radius_meters::numeric / (111000 * cos(radians(latitude)))))
);

-- Enable RLS
ALTER TABLE public.cell_towers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active cell towers"
ON public.cell_towers
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage cell towers"
ON public.cell_towers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_cell_towers_updated_at
BEFORE UPDATE ON public.cell_towers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to find nearby towers for trilateration
CREATE OR REPLACE FUNCTION public.find_nearby_cell_towers(
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_radius_meters INTEGER DEFAULT 5000,
  p_technology TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  tower_id UUID,
  cell_id TEXT,
  operator_name TEXT,
  technology TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  coverage_radius_meters INTEGER,
  distance_meters NUMERIC,
  max_rsrp NUMERIC,
  path_loss_exponent NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lat_delta NUMERIC;
  v_lon_delta NUMERIC;
BEGIN
  -- Calculate approximate degree deltas for bounding box
  v_lat_delta := p_radius_meters::NUMERIC / 111000;
  v_lon_delta := p_radius_meters::NUMERIC / (111000 * cos(radians(p_latitude)));
  
  RETURN QUERY
  SELECT 
    ct.id as tower_id,
    ct.cell_id,
    COALESCE(t.operator_name, 'Unknown') as operator_name,
    ct.technology,
    ct.latitude,
    ct.longitude,
    ct.coverage_radius_meters,
    -- Haversine distance calculation
    (6371000 * acos(
      cos(radians(p_latitude)) * cos(radians(ct.latitude)) * 
      cos(radians(ct.longitude) - radians(p_longitude)) + 
      sin(radians(p_latitude)) * sin(radians(ct.latitude))
    ))::NUMERIC as distance_meters,
    ct.max_rsrp,
    ct.path_loss_exponent
  FROM public.cell_towers ct
  LEFT JOIN public.telecom_operators t ON t.id = ct.telecom_operator_id
  WHERE ct.is_active = true
    AND ct.latitude BETWEEN (p_latitude - v_lat_delta) AND (p_latitude + v_lat_delta)
    AND ct.longitude BETWEEN (p_longitude - v_lon_delta) AND (p_longitude + v_lon_delta)
    AND (p_technology IS NULL OR ct.technology = p_technology)
  ORDER BY distance_meters ASC
  LIMIT p_limit;
END;
$$;

-- Function to estimate position from multiple tower signals
CREATE OR REPLACE FUNCTION public.trilaterate_position(
  p_tower_signals JSONB -- Array of {tower_id, rsrp, rsrq, ta}
)
RETURNS TABLE (
  estimated_latitude NUMERIC,
  estimated_longitude NUMERIC,
  accuracy_meters NUMERIC,
  confidence_score NUMERIC,
  towers_used INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signal JSONB;
  v_tower RECORD;
  v_distance NUMERIC;
  v_weight NUMERIC;
  v_total_weight NUMERIC := 0;
  v_weighted_lat NUMERIC := 0;
  v_weighted_lon NUMERIC := 0;
  v_towers_count INTEGER := 0;
  v_min_accuracy NUMERIC := 9999;
BEGIN
  -- Process each tower signal
  FOR v_signal IN SELECT * FROM jsonb_array_elements(p_tower_signals)
  LOOP
    -- Get tower data
    SELECT * INTO v_tower
    FROM public.cell_towers
    WHERE id = (v_signal->>'tower_id')::UUID
      AND is_active = true;
    
    IF v_tower IS NOT NULL THEN
      -- Estimate distance from RSRP using path loss model
      -- distance = 10^((max_rsrp - rsrp) / (10 * path_loss_exponent))
      v_distance := POWER(10, 
        (COALESCE(v_tower.max_rsrp, -44) - COALESCE((v_signal->>'rsrp')::NUMERIC, -80)) / 
        (10 * COALESCE(v_tower.path_loss_exponent, 3.5))
      );
      
      -- If Timing Advance available, use it for better accuracy
      IF v_signal->>'ta' IS NOT NULL THEN
        v_distance := LEAST(v_distance, (v_signal->>'ta')::NUMERIC * 78.125);
      END IF;
      
      -- Weight inversely proportional to estimated distance
      v_weight := 1.0 / GREATEST(v_distance, 1);
      
      -- Accumulate weighted position
      v_weighted_lat := v_weighted_lat + (v_tower.latitude * v_weight);
      v_weighted_lon := v_weighted_lon + (v_tower.longitude * v_weight);
      v_total_weight := v_total_weight + v_weight;
      v_towers_count := v_towers_count + 1;
      
      -- Track minimum accuracy based on distance
      v_min_accuracy := LEAST(v_min_accuracy, v_distance);
    END IF;
  END LOOP;
  
  -- Return results
  IF v_towers_count > 0 AND v_total_weight > 0 THEN
    RETURN QUERY SELECT
      (v_weighted_lat / v_total_weight)::NUMERIC(10, 7) as estimated_latitude,
      (v_weighted_lon / v_total_weight)::NUMERIC(10, 7) as estimated_longitude,
      CASE 
        WHEN v_towers_count >= 3 THEN v_min_accuracy * 0.5
        WHEN v_towers_count = 2 THEN v_min_accuracy * 0.75
        ELSE v_min_accuracy
      END as accuracy_meters,
      LEAST(1.0, (v_towers_count::NUMERIC / 5.0) * (1.0 / GREATEST(v_min_accuracy / 1000, 0.1))) as confidence_score,
      v_towers_count as towers_used;
  ELSE
    RETURN QUERY SELECT
      NULL::NUMERIC(10, 7),
      NULL::NUMERIC(10, 7),
      NULL::NUMERIC,
      0::NUMERIC,
      0;
  END IF;
END;
$$;