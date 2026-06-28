
-- Block UPDATE and DELETE on afroloc_record_versions at SQL level (append-only)
CREATE RULE prevent_update_versions AS ON UPDATE TO public.afroloc_record_versions DO INSTEAD NOTHING;
CREATE RULE prevent_delete_versions AS ON DELETE TO public.afroloc_record_versions DO INSTEAD NOTHING;
