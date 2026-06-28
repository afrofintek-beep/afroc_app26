-- Create function to delete property photos when afroloc_records are deleted
CREATE OR REPLACE FUNCTION public.delete_afroloc_property_photos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_photo_path TEXT;
BEGIN
  -- Check if photo_metadata contains a file path
  IF OLD.photo_metadata IS NOT NULL AND OLD.photo_metadata->>'file_path' IS NOT NULL THEN
    v_photo_path := OLD.photo_metadata->>'file_path';
    
    -- Delete the photo from storage
    DELETE FROM storage.objects
    WHERE bucket_id = 'property-photos'
      AND name = v_photo_path;
      
    RAISE NOTICE 'Deleted property photo: %', v_photo_path;
  END IF;
  
  -- Also try to delete any photos stored with record ID pattern
  -- This handles photos stored as {user_id}/{record_id}/*
  DELETE FROM storage.objects
  WHERE bucket_id = 'property-photos'
    AND name LIKE '%' || OLD.id::text || '%';
  
  RETURN OLD;
END;
$$;

-- Create trigger to execute before delete on afroloc_records
CREATE TRIGGER trigger_delete_afroloc_property_photos
  BEFORE DELETE ON public.afroloc_records
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_afroloc_property_photos();

-- Add comment for documentation
COMMENT ON FUNCTION public.delete_afroloc_property_photos() IS 'Automatically deletes property photos from storage when afroloc_records are deleted';

-- Create the property-photos storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-photos', 'property-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policies for property-photos bucket
CREATE POLICY "Users can upload their own property photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'property-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own property photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'property-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own property photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'property-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all property photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'property-photos' 
  AND public.has_role(auth.uid(), 'admin')
);