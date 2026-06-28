-- Corrigir política permissiva do audit_log
-- A inserção deve ser restrita a utilizadores autenticados com papel válido

DROP POLICY IF EXISTS "System can insert audit logs" ON public.fine_audit_log;

CREATE POLICY "Authenticated users can insert audit logs"
  ON public.fine_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (actor_user_id = auth.uid());