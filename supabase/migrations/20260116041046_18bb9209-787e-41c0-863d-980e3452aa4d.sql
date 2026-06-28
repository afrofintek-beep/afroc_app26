-- Create afroloc_addresses table
CREATE TABLE public.afroloc_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address_id text UNIQUE NOT NULL,
  country_code text NOT NULL,
  administrative_area text,
  locality text,
  dependent_locality text,
  thoroughfare_name text,
  thoroughfare_type text,
  premise_number text,
  building_name text,
  sub_premise_type text,
  sub_premise_id text,
  post_code text,
  place_name text,
  lat double precision,
  lon double precision,
  tile_id text,
  precision_level text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_afroloc_addresses_country_tile ON public.afroloc_addresses (country_code, tile_id);
CREATE INDEX idx_afroloc_addresses_coords ON public.afroloc_addresses (lat, lon);

-- Enable Row Level Security
ALTER TABLE public.afroloc_addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own addresses
CREATE POLICY "Users can view their own addresses"
  ON public.afroloc_addresses
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own addresses"
  ON public.afroloc_addresses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own addresses"
  ON public.afroloc_addresses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own addresses"
  ON public.afroloc_addresses
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_afroloc_addresses_updated_at
  BEFORE UPDATE ON public.afroloc_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();