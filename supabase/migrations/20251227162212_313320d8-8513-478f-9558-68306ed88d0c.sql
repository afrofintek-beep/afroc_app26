-- Create GPS update history table
CREATE TABLE public.afroloc_gps_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  afroloc_record_id UUID NOT NULL REFERENCES public.afroloc_records(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  previous_lat NUMERIC,
  previous_lon NUMERIC,
  new_lat NUMERIC NOT NULL,
  new_lon NUMERIC NOT NULL,
  distance_meters NUMERIC,
  accuracy_meters NUMERIC,
  update_reason TEXT,
  photo_path TEXT,
  device_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.afroloc_gps_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view GPS history for their records"
ON public.afroloc_gps_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM afroloc_records
    WHERE afroloc_records.id = afroloc_gps_history.afroloc_record_id
    AND afroloc_records.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert GPS history for their records"
ON public.afroloc_gps_history
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM afroloc_records
    WHERE afroloc_records.id = afroloc_gps_history.afroloc_record_id
    AND afroloc_records.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all GPS history"
ON public.afroloc_gps_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for performance
CREATE INDEX idx_gps_history_afroloc_record ON public.afroloc_gps_history(afroloc_record_id);
CREATE INDEX idx_gps_history_created_at ON public.afroloc_gps_history(created_at DESC);