-- Create function to delete storage files when identity_documents are deleted
CREATE OR REPLACE FUNCTION public.delete_identity_document_file()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  -- Delete the file from storage bucket
  DELETE FROM storage.objects
  WHERE bucket_id = 'identity-documents'
    AND name = OLD.file_path;
  
  RETURN OLD;
END;
$$;

-- Create trigger to execute before delete on identity_documents
CREATE TRIGGER trigger_delete_identity_document_file
  BEFORE DELETE ON public.identity_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_identity_document_file();

-- Add comment for documentation
COMMENT ON FUNCTION public.delete_identity_document_file() IS 'Automatically deletes storage files when identity_documents records are deleted';