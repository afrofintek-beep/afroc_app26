
-- Fix all NO ACTION foreign keys referencing afroloc_records to allow deletion

-- afroloc_requests.resulting_afroloc_id -> SET NULL (request should survive)
ALTER TABLE public.afroloc_requests
  DROP CONSTRAINT afroloc_requests_resulting_afroloc_id_fkey,
  ADD CONSTRAINT afroloc_requests_resulting_afroloc_id_fkey
    FOREIGN KEY (resulting_afroloc_id) REFERENCES public.afroloc_records(id) ON DELETE SET NULL;

-- afroloc_validations -> CASCADE
ALTER TABLE public.afroloc_validations
  DROP CONSTRAINT afroloc_validations_afroloc_record_id_fkey,
  ADD CONSTRAINT afroloc_validations_afroloc_record_id_fkey
    FOREIGN KEY (afroloc_record_id) REFERENCES public.afroloc_records(id) ON DELETE CASCADE;

-- afroloc_witnesses -> CASCADE
ALTER TABLE public.afroloc_witnesses
  DROP CONSTRAINT afroloc_witnesses_afroloc_record_id_fkey,
  ADD CONSTRAINT afroloc_witnesses_afroloc_record_id_fkey
    FOREIGN KEY (afroloc_record_id) REFERENCES public.afroloc_records(id) ON DELETE CASCADE;

-- identity_documents -> CASCADE
ALTER TABLE public.identity_documents
  DROP CONSTRAINT identity_documents_afroloc_record_id_fkey,
  ADD CONSTRAINT identity_documents_afroloc_record_id_fkey
    FOREIGN KEY (afroloc_record_id) REFERENCES public.afroloc_records(id) ON DELETE CASCADE;

-- violation_events -> SET NULL
ALTER TABLE public.violation_events
  DROP CONSTRAINT violation_events_afroloc_id_fkey,
  ADD CONSTRAINT violation_events_afroloc_id_fkey
    FOREIGN KEY (afroloc_id) REFERENCES public.afroloc_records(id) ON DELETE SET NULL;

-- witness_contract_downloads -> CASCADE
ALTER TABLE public.witness_contract_downloads
  DROP CONSTRAINT witness_contract_downloads_afroloc_record_id_fkey,
  ADD CONSTRAINT witness_contract_downloads_afroloc_record_id_fkey
    FOREIGN KEY (afroloc_record_id) REFERENCES public.afroloc_records(id) ON DELETE CASCADE;
