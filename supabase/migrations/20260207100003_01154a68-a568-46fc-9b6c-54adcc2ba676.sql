
-- Remove the RULE that blocks CASCADE deletes on afroloc_record_versions
DROP RULE IF EXISTS prevent_delete_versions ON public.afroloc_record_versions;

-- Replace with an RLS policy that prevents direct user deletes but allows cascade
-- The CASCADE delete from parent table bypasses RLS, so this is safe
ALTER TABLE public.afroloc_record_versions ENABLE ROW LEVEL SECURITY;

-- Deny direct DELETE by any user (CASCADE from FK still works as it bypasses RLS)
DROP POLICY IF EXISTS "No direct delete on versions" ON public.afroloc_record_versions;
CREATE POLICY "No direct delete on versions"
  ON public.afroloc_record_versions
  FOR DELETE
  USING (false);
