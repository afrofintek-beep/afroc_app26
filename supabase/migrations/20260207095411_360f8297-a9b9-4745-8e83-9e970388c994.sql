
-- Fix: allow deleting afroloc_records by cascading to afroloc_record_versions
ALTER TABLE public.afroloc_record_versions
  DROP CONSTRAINT afroloc_record_versions_record_id_fkey,
  ADD CONSTRAINT afroloc_record_versions_record_id_fkey
    FOREIGN KEY (record_id) REFERENCES public.afroloc_records(id) ON DELETE CASCADE;
