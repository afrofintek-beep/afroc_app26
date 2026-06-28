-- Create enum for request status
CREATE TYPE public.afroloc_request_status AS ENUM (
  'pending_otp',
  'otp_verified',
  'pending_document',
  'pending_assignment',
  'assigned',
  'in_progress',
  'pending_site_visit',
  'completed',
  'rejected',
  'cancelled'
);

-- Create table for AFROLOC requests
CREATE TABLE public.afroloc_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Requester info
  requester_phone text NOT NULL,
  requester_name text,
  requester_document_type text,
  requester_document_number text,
  requester_document_path text,
  
  -- Address info (formal address)
  street_name text NOT NULL,
  house_number text NOT NULL,
  neighborhood text,
  city text,
  country_code text NOT NULL DEFAULT 'AO',
  level1_code text,
  level1_name text,
  level2_code text,
  level2_name text,
  level3_code text,
  level3_name text,
  level4_code text,
  level4_name text,
  
  -- GPS coordinates from device
  geo_lat numeric,
  geo_lon numeric,
  
  -- Facade photo
  facade_photo_path text,
  
  -- OTP verification
  otp_code text,
  otp_expires_at timestamptz,
  otp_verified_at timestamptz,
  otp_attempts integer DEFAULT 0,
  
  -- Assignment / delegation
  assigned_to_user_id uuid,
  assigned_by_user_id uuid,
  assigned_at timestamptz,
  
  -- Site visit verification
  site_visit_at timestamptz,
  site_visit_by_user_id uuid,
  site_visit_geo_lat numeric,
  site_visit_geo_lon numeric,
  site_visit_photo_path text,
  site_visit_notes text,
  
  -- Result
  status afroloc_request_status NOT NULL DEFAULT 'pending_otp',
  resulting_afroloc_id uuid REFERENCES public.afroloc_records(id),
  rejection_reason text,
  
  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.afroloc_requests ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_afroloc_requests_phone ON public.afroloc_requests(requester_phone);
CREATE INDEX idx_afroloc_requests_status ON public.afroloc_requests(status);
CREATE INDEX idx_afroloc_requests_assigned_to ON public.afroloc_requests(assigned_to_user_id);
CREATE INDEX idx_afroloc_requests_otp ON public.afroloc_requests(otp_code, otp_expires_at);

-- RLS Policies

-- Admins can do everything
CREATE POLICY "Admins can manage all requests"
ON public.afroloc_requests
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Level 4+ users can view all requests in their jurisdiction
CREATE POLICY "Level 4+ can view jurisdiction requests"
ON public.afroloc_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_authorization_levels ual
    WHERE ual.user_id = auth.uid()
    AND ual.current_level >= 4
    AND (
      ual.jurisdiction_country = afroloc_requests.country_code
      OR ual.jurisdiction_level1_code = afroloc_requests.level1_code
    )
  )
);

-- Level 4+ users can assign requests
CREATE POLICY "Level 4+ can assign requests"
ON public.afroloc_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_authorization_levels ual
    WHERE ual.user_id = auth.uid()
    AND ual.current_level >= 4
    AND (
      ual.jurisdiction_country = afroloc_requests.country_code
      OR ual.jurisdiction_level1_code = afroloc_requests.level1_code
    )
  )
);

-- Assigned validators can view and update their assigned requests
CREATE POLICY "Validators can view assigned requests"
ON public.afroloc_requests
FOR SELECT
USING (assigned_to_user_id = auth.uid());

CREATE POLICY "Validators can update assigned requests"
ON public.afroloc_requests
FOR UPDATE
USING (assigned_to_user_id = auth.uid());

-- System can insert new requests (from edge functions)
CREATE POLICY "System can insert requests"
ON public.afroloc_requests
FOR INSERT
WITH CHECK (true);

-- Create updated_at trigger
CREATE TRIGGER update_afroloc_requests_updated_at
BEFORE UPDATE ON public.afroloc_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create assignment history table for audit trail
CREATE TABLE public.afroloc_request_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.afroloc_requests(id) ON DELETE CASCADE,
  assigned_to_user_id uuid NOT NULL,
  assigned_by_user_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  reassignment_reason text,
  notes text
);

ALTER TABLE public.afroloc_request_assignments ENABLE ROW LEVEL SECURITY;

-- RLS for assignment history
CREATE POLICY "Admins can view all assignments"
ON public.afroloc_request_assignments
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Level 4+ can view assignments in jurisdiction"
ON public.afroloc_request_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.afroloc_requests ar
    JOIN public.user_authorization_levels ual ON ual.user_id = auth.uid()
    WHERE ar.id = afroloc_request_assignments.request_id
    AND ual.current_level >= 4
    AND (
      ual.jurisdiction_country = ar.country_code
      OR ual.jurisdiction_level1_code = ar.level1_code
    )
  )
);

CREATE POLICY "Validators can view their assignments"
ON public.afroloc_request_assignments
FOR SELECT
USING (assigned_to_user_id = auth.uid());

CREATE POLICY "Level 4+ can insert assignments"
ON public.afroloc_request_assignments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_authorization_levels ual
    WHERE ual.user_id = auth.uid()
    AND ual.current_level >= 4
  )
);

-- Create storage bucket for request documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('afroloc-request-docs', 'afroloc-request-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for request documents
CREATE POLICY "Validators can view request docs"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'afroloc-request-docs'
  AND EXISTS (
    SELECT 1 FROM public.afroloc_requests ar
    WHERE (
      ar.requester_document_path = storage.objects.name
      OR ar.facade_photo_path = storage.objects.name
      OR ar.site_visit_photo_path = storage.objects.name
    )
    AND (
      ar.assigned_to_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_authorization_levels ual
        WHERE ual.user_id = auth.uid()
        AND ual.current_level >= 4
      )
    )
  )
);

CREATE POLICY "System can upload request docs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'afroloc-request-docs');

CREATE POLICY "Validators can upload site visit photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'afroloc-request-docs'
  AND auth.uid() IS NOT NULL
);