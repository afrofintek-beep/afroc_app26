-- ============================================================
-- GATE DE APROVAÇÃO DE UTILIZADORES (fase experimental)
-- Após concluir o REGISTO DA CONTA, o novo utilizador fica 'pending' e
-- NÃO acede à app até um admin o aprovar. Ligável/desligável por flag.
-- Contas EXISTENTES ficam todas 'approved' (nunca trancar quem já entrou).
-- ============================================================

-- 1) Definições globais da app (flags) ----------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid
);
alter table public.app_settings enable row level security;

drop policy if exists "app_settings readable by authenticated" on public.app_settings;
create policy "app_settings readable by authenticated"
  on public.app_settings for select to authenticated using (true);

drop policy if exists "app_settings writable by admins" on public.app_settings;
create policy "app_settings writable by admins"
  on public.app_settings for all to authenticated
  using (exists (select 1 from public.user_roles ur
                 where ur.user_id = auth.uid()
                   and ur.role in ('admin','admin_national','admin_province','admin_municipality')))
  with check (exists (select 1 from public.user_roles ur
                 where ur.user_id = auth.uid()
                   and ur.role in ('admin','admin_national','admin_province','admin_municipality')));

-- Flag: exigir aprovação manual dos novos registos (FASE EXPERIMENTAL = ligado)
insert into public.app_settings (key, value)
values ('experimental_approval_required', 'true'::jsonb)
on conflict (key) do nothing;

-- 2) Colunas de aprovação em profiles -----------------------------------------
alter table public.profiles
  add column if not exists approval_status text not null default 'approved',
  add column if not exists approval_requested_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by_user_id uuid,
  add column if not exists rejection_reason text;

do $$ begin
  alter table public.profiles
    add constraint profiles_approval_status_chk
    check (approval_status in ('approved','pending','rejected'));
exception when duplicate_object then null; end $$;

-- Segurança: garantir que todos os EXISTENTES ficam aprovados.
update public.profiles set approval_status = 'approved'
 where approval_status is null or approval_status = '';

-- 3) handle_new_user: marcar 'pending' quando a flag experimental está ligada --
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gate boolean;
begin
  select coalesce((value #>> '{}')::boolean, false) into v_gate
    from public.app_settings where key = 'experimental_approval_required';

  insert into public.profiles (
    user_id, full_name, phone, country, city, purpose, onboarding_completed,
    approval_status, approval_requested_at
  )
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'city',
    case when new.raw_user_meta_data->'purpose' is not null
      then array(select jsonb_array_elements_text(new.raw_user_meta_data->'purpose'))
      else null end,
    coalesce(new.raw_user_meta_data->>'country' is not null, false),
    case when v_gate then 'pending' else 'approved' end,
    case when v_gate then now() else null end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) RPC: admin aprova/recusa um utilizador -----------------------------------
create or replace function public.set_user_approval(
  p_user_id uuid,
  p_status  text,
  p_reason  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin','admin_national','admin_province','admin_municipality')
  ) then
    raise exception 'forbidden: admin role required';
  end if;

  if p_status not in ('approved','rejected') then
    raise exception 'invalid status: %', p_status;
  end if;

  update public.profiles
     set approval_status     = p_status,
         approved_at         = case when p_status = 'approved' then now() else approved_at end,
         approved_by_user_id = auth.uid(),
         rejection_reason    = case when p_status = 'rejected' then p_reason else null end,
         updated_at          = now()
   where user_id = p_user_id;
end;
$$;

grant execute on function public.set_user_approval(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
