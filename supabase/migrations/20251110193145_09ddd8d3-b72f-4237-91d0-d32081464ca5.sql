-- Create storage bucket for identity documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'identity-documents',
  'identity-documents',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

-- Policy: Users can view their own identity documents
CREATE POLICY "Users can view their own identity documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'identity-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can upload their own identity documents
CREATE POLICY "Users can upload their own identity documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'identity-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own identity documents
CREATE POLICY "Users can update their own identity documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'identity-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own identity documents
CREATE POLICY "Users can delete their own identity documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'identity-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Admins can view all identity documents
CREATE POLICY "Admins can view all identity documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'identity-documents' 
  AND has_role(auth.uid(), 'admin')
);

-- Create table to track document uploads
CREATE TABLE public.identity_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  afroid_record_id UUID NOT NULL REFERENCES public.afroid_records(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by_user_id UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.identity_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own documents
CREATE POLICY "Users can view their own documents"
ON public.identity_documents
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own documents
CREATE POLICY "Users can insert their own documents"
ON public.identity_documents
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own pending documents
CREATE POLICY "Users can update their own pending documents"
ON public.identity_documents
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

-- Policy: Users can delete their own pending documents
CREATE POLICY "Users can delete their own pending documents"
ON public.identity_documents
FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');

-- Policy: Admins can view all documents
CREATE POLICY "Admins can view all documents"
ON public.identity_documents
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Policy: Admins can update documents (for verification)
CREATE POLICY "Admins can update documents"
ON public.identity_documents
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_identity_documents_updated_at
BEFORE UPDATE ON public.identity_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_identity_documents_afroid_record ON public.identity_documents(afroid_record_id);
CREATE INDEX idx_identity_documents_user ON public.identity_documents(user_id);
CREATE INDEX idx_identity_documents_status ON public.identity_documents(status);