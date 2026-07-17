-- ─────────────────────────────────────────────────────────────────────────────
--  REDE IMBAMBA — Fase 3: equipa & papéis (consola multi-operador / PPP).
--
--  net_managers já existe (Fase 1). Aqui: rastrear quem adicionou cada gestor e
--  expor o papel do próprio à app. Papéis: 'owner' (bootstrap), 'manager' (global,
--  operator_id NULL), 'operator_admin' (âmbito de um operador). O ENFORCEMENT de
--  âmbito continua a ser `operator_id` via net_is_manager(); o `role` é rótulo.
--
--  A gestão da equipa (listar/adicionar/remover, com resolução de e-mail) é feita
--  pela edge function `net-team` (service role), que só deixa gestores GLOBAIS gerir.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.net_managers add column if not exists added_by uuid;

-- Papel do próprio utilizador (a app usa para mostrar/esconder a aba Equipa e
-- adaptar o âmbito). Devolve NULL se não for gestor.
create or replace function public.net_my_role()
returns jsonb language sql stable security definer set search_path = public as $$
  select (
    select jsonb_build_object('role', role, 'operator_id', operator_id)
      from public.net_managers where user_id = auth.uid() limit 1
  );
$$;
grant execute on function public.net_my_role() to authenticated;
