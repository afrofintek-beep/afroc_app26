-- Create documents table for document management
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,            -- juridico | governo | dfis | tecnico
  language TEXT NOT NULL,            -- pt | en | fr
  version TEXT NOT NULL,             -- v1.0, v1.1, etc.
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public', -- public | restricted
  file_path TEXT NOT NULL,           -- caminho interno (ou URL)
  sha256 TEXT NOT NULL,              -- hash para auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS ix_docs_category ON public.documents(category);
CREATE INDEX IF NOT EXISTS ix_docs_language ON public.documents(language);
CREATE INDEX IF NOT EXISTS ix_docs_visibility ON public.documents(visibility);
CREATE INDEX IF NOT EXISTS ix_docs_published_at ON public.documents(published_at);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Public documents are viewable by anyone
CREATE POLICY "Public documents are viewable by everyone"
ON public.documents
FOR SELECT
USING (visibility = 'public');

-- Restricted documents viewable by authenticated users
CREATE POLICY "Restricted documents viewable by authenticated users"
ON public.documents
FOR SELECT
USING (visibility = 'restricted' AND auth.uid() IS NOT NULL);

-- Admins can manage all documents
CREATE POLICY "Admins can manage all documents"
ON public.documents
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add check constraints for valid values
ALTER TABLE public.documents
ADD CONSTRAINT documents_category_check 
CHECK (category IN ('juridico', 'governo', 'dfis', 'tecnico'));

ALTER TABLE public.documents
ADD CONSTRAINT documents_language_check 
CHECK (language IN ('pt', 'en', 'fr'));

ALTER TABLE public.documents
ADD CONSTRAINT documents_visibility_check 
CHECK (visibility IN ('public', 'restricted'));