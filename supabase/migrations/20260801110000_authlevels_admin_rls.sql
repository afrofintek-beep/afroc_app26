-- Fix RLS: admins têm de poder INSERIR/ATUALIZAR níveis de autorização.
-- Antes, o INSERT só era permitido ao service_role, e o upsert do cliente
-- (Gestão Regional → "Atribuir Nível") batia na RLS → "Erro ao atribuir nível".
-- Também alarga o UPDATE de admins a todos os papéis de admin (não só 'admin').

drop policy if exists "Admins can insert authorization levels" on public.user_authorization_levels;
create policy "Admins can insert authorization levels"
on public.user_authorization_levels for insert to authenticated
with check (exists (
  select 1 from public.user_roles ur
  where ur.user_id = auth.uid()
    and ur.role in ('admin','admin_national','admin_province','admin_municipality')
));

drop policy if exists "Admins can update authorization levels" on public.user_authorization_levels;
create policy "Admins can update authorization levels"
on public.user_authorization_levels for update to authenticated
using (exists (
  select 1 from public.user_roles ur
  where ur.user_id = auth.uid()
    and ur.role in ('admin','admin_national','admin_province','admin_municipality')
));

notify pgrst, 'reload schema';
