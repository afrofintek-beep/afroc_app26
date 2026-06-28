-- Create administrative_divisions table
CREATE TABLE public.administrative_divisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level >= 1 AND level <= 4),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_code TEXT,
  parent_level INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by_user_id UUID,
  UNIQUE(country_code, level, code)
);

-- Create index for faster queries
CREATE INDEX idx_admin_divisions_country_level ON public.administrative_divisions(country_code, level);
CREATE INDEX idx_admin_divisions_parent ON public.administrative_divisions(parent_code, parent_level);

-- Enable RLS
ALTER TABLE public.administrative_divisions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view administrative divisions"
  ON public.administrative_divisions
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert administrative divisions"
  ON public.administrative_divisions
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update administrative divisions"
  ON public.administrative_divisions
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete administrative divisions"
  ON public.administrative_divisions
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_administrative_divisions_updated_at
  BEFORE UPDATE ON public.administrative_divisions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for import files
INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-imports', 'admin-imports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for admin imports
CREATE POLICY "Admins can upload import files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'admin-imports' 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can view import files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'admin-imports' 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can delete import files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'admin-imports' 
    AND has_role(auth.uid(), 'admin'::app_role)
  );