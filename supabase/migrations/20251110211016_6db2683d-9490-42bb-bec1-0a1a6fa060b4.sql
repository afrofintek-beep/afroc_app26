-- Create countries configuration table
CREATE TABLE IF NOT EXISTS public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT UNIQUE NOT NULL,
  country_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  
  -- Administrative structure
  admin_levels_count INTEGER DEFAULT 4 CHECK (admin_levels_count >= 1 AND admin_levels_count <= 5),
  level1_label TEXT DEFAULT 'Province',
  level2_label TEXT DEFAULT 'Territory',
  level3_label TEXT DEFAULT 'Commune',
  level4_label TEXT DEFAULT 'Quartier',
  level5_label TEXT DEFAULT 'Street',
  
  -- AFRO ID Configuration
  afro_id_format TEXT DEFAULT '{COUNTRY}-{LEVEL1}-{NUMBER}',
  afro_id_prefix TEXT,
  
  -- Validation settings
  requires_authority_validation BOOLEAN DEFAULT true,
  requires_witness_validation BOOLEAN DEFAULT true,
  min_witnesses_required INTEGER DEFAULT 2,
  
  -- Address format
  address_format JSONB DEFAULT '{"components": ["number", "street_name", "level4", "level3", "level2", "level1", "country"]}'::jsonb,
  
  -- Phone settings
  phone_country_code TEXT,
  phone_number_format TEXT,
  
  -- Metadata
  timezone TEXT DEFAULT 'UTC',
  currency TEXT,
  language_codes TEXT[] DEFAULT ARRAY['en'],
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by_user_id UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active countries"
  ON public.countries
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage countries"
  ON public.countries
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Create index for faster lookups
CREATE INDEX idx_countries_code ON public.countries(country_code);
CREATE INDEX idx_countries_active ON public.countries(is_active);

-- Update trigger
CREATE TRIGGER update_countries_updated_at
  BEFORE UPDATE ON public.countries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default country (Democratic Republic of Congo)
INSERT INTO public.countries (
  country_code,
  country_name,
  admin_levels_count,
  level1_label,
  level2_label,
  level3_label,
  level4_label,
  afro_id_format,
  afro_id_prefix,
  phone_country_code,
  timezone,
  currency,
  language_codes
) VALUES (
  'CD',
  'Democratic Republic of Congo',
  4,
  'Province',
  'Territory',
  'Commune',
  'Quartier',
  '{COUNTRY}-{LEVEL1}-{NUMBER}',
  'CD',
  '+243',
  'Africa/Kinshasa',
  'CDF',
  ARRAY['fr', 'ln', 'sw', 'kg']
) ON CONFLICT (country_code) DO NOTHING;