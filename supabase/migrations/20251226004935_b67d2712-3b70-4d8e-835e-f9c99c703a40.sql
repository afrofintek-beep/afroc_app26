-- Create table for cadastral creation rules per region
CREATE TABLE IF NOT EXISTS public.cadastral_creation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  level1_code text, -- Province level (null = applies to whole country)
  level2_code text, -- Municipality level (null = applies to whole province)
  
  -- Authorization requirements
  min_authorization_level integer NOT NULL DEFAULT 4,
  auto_approve_level integer NOT NULL DEFAULT 5, -- Level 5+ auto-approved
  
  -- Geographic constraints
  enforce_boundaries boolean NOT NULL DEFAULT true,
  allowed_zone_types text[] DEFAULT ARRAY['urban', 'rural'],
  
  -- Quotas and limits
  max_cells_per_batch integer DEFAULT 500,
  max_cells_per_day integer DEFAULT 2000,
  max_cells_per_month integer DEFAULT 50000,
  
  -- Protected zones (array of bbox objects as JSONB)
  protected_zones jsonb DEFAULT '[]'::jsonb,
  
  -- Approval workflow
  requires_approval boolean NOT NULL DEFAULT false,
  approval_levels integer[] DEFAULT ARRAY[5, 6], -- Levels that can approve
  
  -- Metadata
  created_by_user_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  notes text,
  
  CONSTRAINT unique_region_rule UNIQUE (country_code, level1_code, level2_code)
);

-- Create table for protected/restricted zones
CREATE TABLE IF NOT EXISTS public.cadastral_protected_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  name text NOT NULL,
  zone_type text NOT NULL DEFAULT 'restricted', -- 'restricted', 'military', 'reserve', 'heritage'
  
  -- Geographic bounds
  min_lat numeric NOT NULL,
  max_lat numeric NOT NULL,
  min_lon numeric NOT NULL,
  max_lon numeric NOT NULL,
  
  -- Or polygon geometry for complex shapes
  boundary_geojson jsonb,
  
  -- Restrictions
  creation_blocked boolean DEFAULT true,
  requires_special_approval boolean DEFAULT true,
  special_approval_level integer DEFAULT 6,
  
  -- Administrative
  level1_code text,
  level1_name text,
  created_by_user_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  reason text
);

-- Create table for tracking cell creation quotas
CREATE TABLE IF NOT EXISTS public.cadastral_creation_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  country_code text NOT NULL,
  level1_code text,
  
  -- Daily tracking
  cells_created_today integer DEFAULT 0,
  last_creation_date date DEFAULT CURRENT_DATE,
  
  -- Monthly tracking  
  cells_created_month integer DEFAULT 0,
  last_creation_month text DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
  
  -- Total tracking
  total_cells_created integer DEFAULT 0,
  
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_quota UNIQUE (user_id, country_code, level1_code)
);

-- Enable RLS
ALTER TABLE public.cadastral_creation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadastral_protected_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadastral_creation_quotas ENABLE ROW LEVEL SECURITY;

-- Policies for cadastral_creation_rules
CREATE POLICY "Anyone can view active creation rules"
  ON public.cadastral_creation_rules
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage creation rules"
  ON public.cadastral_creation_rules
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Policies for cadastral_protected_zones
CREATE POLICY "Anyone can view active protected zones"
  ON public.cadastral_protected_zones
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage protected zones"
  ON public.cadastral_protected_zones
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Policies for cadastral_creation_quotas
CREATE POLICY "Users can view their own quotas"
  ON public.cadastral_creation_quotas
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage quotas"
  ON public.cadastral_creation_quotas
  FOR ALL
  USING (true);

-- Function to check if cell creation is allowed
CREATE OR REPLACE FUNCTION public.check_cell_creation_allowed(
  p_user_id uuid,
  p_country_code text,
  p_level1_code text DEFAULT NULL,
  p_lat numeric DEFAULT NULL,
  p_lon numeric DEFAULT NULL,
  p_cell_count integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_level integer;
  v_rule record;
  v_protected record;
  v_quota record;
  v_result jsonb;
BEGIN
  -- Get user authorization level
  SELECT current_level INTO v_user_level
  FROM user_authorization_levels
  WHERE user_id = p_user_id;
  
  IF v_user_level IS NULL THEN
    v_user_level := 1;
  END IF;
  
  -- Find applicable rule (most specific first)
  SELECT * INTO v_rule
  FROM cadastral_creation_rules
  WHERE country_code = p_country_code
    AND is_active = true
    AND (level1_code IS NULL OR level1_code = p_level1_code)
  ORDER BY 
    CASE WHEN level1_code IS NOT NULL THEN 0 ELSE 1 END,
    CASE WHEN level2_code IS NOT NULL THEN 0 ELSE 1 END
  LIMIT 1;
  
  -- Default rule if none found
  IF v_rule IS NULL THEN
    v_rule := ROW(
      null::uuid, p_country_code, null, null,
      4, 5, true, ARRAY['urban', 'rural'],
      500, 2000, 50000, '[]'::jsonb,
      false, ARRAY[5, 6],
      null, now(), now(), true, null
    );
  END IF;
  
  -- Check minimum authorization level
  IF v_user_level < v_rule.min_authorization_level THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'authorization_level_insufficient',
      'required_level', v_rule.min_authorization_level,
      'user_level', v_user_level
    );
  END IF;
  
  -- Check if location is in a protected zone
  IF p_lat IS NOT NULL AND p_lon IS NOT NULL THEN
    SELECT * INTO v_protected
    FROM cadastral_protected_zones
    WHERE country_code = p_country_code
      AND is_active = true
      AND creation_blocked = true
      AND p_lat BETWEEN min_lat AND max_lat
      AND p_lon BETWEEN min_lon AND max_lon
    LIMIT 1;
    
    IF v_protected IS NOT NULL THEN
      -- Check if user has special approval level
      IF v_user_level < COALESCE(v_protected.special_approval_level, 6) THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'reason', 'protected_zone',
          'zone_name', v_protected.name,
          'zone_type', v_protected.zone_type,
          'required_level', v_protected.special_approval_level
        );
      END IF;
    END IF;
  END IF;
  
  -- Check quotas
  SELECT * INTO v_quota
  FROM cadastral_creation_quotas
  WHERE user_id = p_user_id
    AND country_code = p_country_code
    AND (level1_code IS NULL OR level1_code = p_level1_code);
  
  IF v_quota IS NOT NULL THEN
    -- Reset daily counter if new day
    IF v_quota.last_creation_date < CURRENT_DATE THEN
      UPDATE cadastral_creation_quotas
      SET cells_created_today = 0, last_creation_date = CURRENT_DATE
      WHERE id = v_quota.id;
      v_quota.cells_created_today := 0;
    END IF;
    
    -- Reset monthly counter if new month
    IF v_quota.last_creation_month < to_char(CURRENT_DATE, 'YYYY-MM') THEN
      UPDATE cadastral_creation_quotas
      SET cells_created_month = 0, last_creation_month = to_char(CURRENT_DATE, 'YYYY-MM')
      WHERE id = v_quota.id;
      v_quota.cells_created_month := 0;
    END IF;
    
    -- Check batch limit
    IF p_cell_count > v_rule.max_cells_per_batch THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'batch_limit_exceeded',
        'max_per_batch', v_rule.max_cells_per_batch,
        'requested', p_cell_count
      );
    END IF;
    
    -- Check daily limit
    IF (v_quota.cells_created_today + p_cell_count) > v_rule.max_cells_per_day THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'daily_limit_exceeded',
        'max_per_day', v_rule.max_cells_per_day,
        'used_today', v_quota.cells_created_today,
        'requested', p_cell_count
      );
    END IF;
    
    -- Check monthly limit
    IF (v_quota.cells_created_month + p_cell_count) > v_rule.max_cells_per_month THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'monthly_limit_exceeded',
        'max_per_month', v_rule.max_cells_per_month,
        'used_month', v_quota.cells_created_month,
        'requested', p_cell_count
      );
    END IF;
  END IF;
  
  -- Determine if auto-approved
  v_result := jsonb_build_object(
    'allowed', true,
    'auto_approved', v_user_level >= v_rule.auto_approve_level,
    'requires_approval', v_rule.requires_approval AND v_user_level < v_rule.auto_approve_level,
    'user_level', v_user_level,
    'rule_id', v_rule.id
  );
  
  RETURN v_result;
END;
$$;

-- Function to increment quota after cell creation
CREATE OR REPLACE FUNCTION public.increment_cell_creation_quota(
  p_user_id uuid,
  p_country_code text,
  p_level1_code text DEFAULT NULL,
  p_cell_count integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO cadastral_creation_quotas (
    user_id, country_code, level1_code,
    cells_created_today, cells_created_month, total_cells_created,
    last_creation_date, last_creation_month
  )
  VALUES (
    p_user_id, p_country_code, p_level1_code,
    p_cell_count, p_cell_count, p_cell_count,
    CURRENT_DATE, to_char(CURRENT_DATE, 'YYYY-MM')
  )
  ON CONFLICT (user_id, country_code, level1_code)
  DO UPDATE SET
    cells_created_today = CASE 
      WHEN cadastral_creation_quotas.last_creation_date < CURRENT_DATE THEN p_cell_count
      ELSE cadastral_creation_quotas.cells_created_today + p_cell_count
    END,
    cells_created_month = CASE
      WHEN cadastral_creation_quotas.last_creation_month < to_char(CURRENT_DATE, 'YYYY-MM') THEN p_cell_count
      ELSE cadastral_creation_quotas.cells_created_month + p_cell_count
    END,
    total_cells_created = cadastral_creation_quotas.total_cells_created + p_cell_count,
    last_creation_date = CURRENT_DATE,
    last_creation_month = to_char(CURRENT_DATE, 'YYYY-MM'),
    updated_at = now();
END;
$$;

-- Insert default rules for Angola
INSERT INTO public.cadastral_creation_rules (
  country_code, level1_code, level2_code,
  min_authorization_level, auto_approve_level,
  enforce_boundaries, allowed_zone_types,
  max_cells_per_batch, max_cells_per_day, max_cells_per_month,
  requires_approval, approval_levels,
  notes
) VALUES (
  'AO', NULL, NULL,
  4, 5,
  true, ARRAY['urban', 'rural'],
  500, 2000, 50000,
  false, ARRAY[5, 6],
  'Regras padrão para Angola - Nível 5+ auto-aprovado'
) ON CONFLICT (country_code, level1_code, level2_code) DO NOTHING;

-- Insert sample protected zone (placeholder)
INSERT INTO public.cadastral_protected_zones (
  country_code, name, zone_type,
  min_lat, max_lat, min_lon, max_lon,
  level1_code, level1_name,
  creation_blocked, requires_special_approval, special_approval_level,
  reason
) VALUES (
  'AO', 'Parque Nacional da Quiçama', 'reserve',
  -10.5, -9.0, 13.5, 15.0,
  'LDA', 'Luanda',
  true, true, 6,
  'Área de conservação natural - criação de células cadastrais requer aprovação especial'
) ON CONFLICT DO NOTHING;