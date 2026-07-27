-- Torna o trigger de limpeza de fotos TOLERANTE ao bloqueio de storage.
-- O Supabase proíbe DELETE direto em storage.objects (protect_delete), o que
-- fazia FALHAR toda a eliminação de afroloc_records (por SQL e pelo botão
-- "Eliminar" da app via address-gateway). Agora a limpeza de fotos é best-effort:
-- se o storage bloquear, ignora-se o erro e o registo é apagado à mesma
-- (as fotos ficam órfãs — inofensivo; uma limpeza de storage pode tratá-las).
CREATE OR REPLACE FUNCTION public.delete_afroloc_property_photos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_photo_path TEXT;
BEGIN
  IF OLD.photo_metadata IS NOT NULL AND OLD.photo_metadata->>'file_path' IS NOT NULL THEN
    v_photo_path := OLD.photo_metadata->>'file_path';
    BEGIN
      DELETE FROM storage.objects
      WHERE bucket_id = 'property-photos'
        AND name = v_photo_path;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip storage photo delete (protected): %', v_photo_path;
    END;
  END IF;

  BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = 'property-photos'
      AND name LIKE '%' || OLD.id::text || '%';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skip storage photo delete by pattern (protected)';
  END;

  RETURN OLD;
END;
$$;
