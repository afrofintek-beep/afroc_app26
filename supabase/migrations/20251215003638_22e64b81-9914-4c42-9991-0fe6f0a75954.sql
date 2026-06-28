-- Create storage bucket for document library
INSERT INTO storage.buckets (id, name, public)
VALUES ('document-library', 'document-library', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for document-library bucket
CREATE POLICY "Public documents accessible by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'document-library');

CREATE POLICY "Admins can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'document-library' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'document-library' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'document-library' AND has_role(auth.uid(), 'admin'::app_role));