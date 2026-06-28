-- Create witness contract downloads tracking table
CREATE TABLE public.witness_contract_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  witness_id UUID NOT NULL REFERENCES public.afroid_witnesses(id) ON DELETE CASCADE,
  afroid_record_id UUID NOT NULL REFERENCES public.afroid_records(id) ON DELETE CASCADE,
  downloaded_by_user_id UUID NOT NULL,
  downloaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  witness_afro_id TEXT NOT NULL,
  afroid_code TEXT NOT NULL,
  email_sent BOOLEAN DEFAULT FALSE,
  email_status TEXT,
  whatsapp_sent BOOLEAN DEFAULT FALSE,
  whatsapp_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.witness_contract_downloads ENABLE ROW LEVEL SECURITY;

-- Admins can view all download logs
CREATE POLICY "Admins can view all download logs"
ON public.witness_contract_downloads
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- System can insert download logs
CREATE POLICY "System can insert download logs"
ON public.witness_contract_downloads
FOR INSERT
WITH CHECK (true);

-- Create index for better query performance
CREATE INDEX idx_witness_contract_downloads_witness_id ON public.witness_contract_downloads(witness_id);
CREATE INDEX idx_witness_contract_downloads_afroid_record_id ON public.witness_contract_downloads(afroid_record_id);
CREATE INDEX idx_witness_contract_downloads_downloaded_at ON public.witness_contract_downloads(downloaded_at DESC);