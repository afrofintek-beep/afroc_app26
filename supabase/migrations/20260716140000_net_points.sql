-- ─────────────────────────────────────────────────────────────────────────────
--  REDE DE DISTRIBUIÇÃO/RECOLHA — Fase 1: pontos da rede (infraestrutura gerida).
--
--  Os PONTOS são a infraestrutura física da rede postal AFROLOC: estações,
--  lockers, pontos de recolha (pickup) e agências. Ancoram-se na ESTAÇÃO PPMM
--  (província+município), alinhada com o CEP / Caixa Postal.
--
--  Consumido pela app "AFROLOC Rede" (frontend separado, mesmo backend ljcx).
--  Fase 2 = encomendas (net_parcels); Fase 3 = consola multi-operador + papéis.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enums (idempotentes) ---------------------------------------------------------
do $$ begin
  create type public.net_point_type as enum ('station','locker','pickup','agency');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.net_point_status as enum ('active','inactive','planned');
exception when duplicate_object then null; end $$;

-- Gestores da rede (quem pode criar/editar pontos) ----------------------------
--  operator_id NULL = gestor global (toda a rede); caso contrário, âmbito do operador.
create table if not exists public.net_managers (
  user_id     uuid primary key,
  operator_id uuid references public.afroloc_operators(id) on delete set null,
  role        text not null default 'manager',
  created_at  timestamptz not null default now()
);
alter table public.net_managers enable row level security;

-- Cada um vê o seu próprio registo de gestor (para a app saber se é gestor).
drop policy if exists net_managers_select_self on public.net_managers;
create policy net_managers_select_self on public.net_managers
  for select using (user_id = auth.uid());

-- Pontos da rede ---------------------------------------------------------------
create table if not exists public.net_points (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,                 -- ex.: "0515-EST-001"
  name           text not null,
  point_type     public.net_point_type   not null default 'station',
  status         public.net_point_status not null default 'active',
  operator_id    uuid references public.afroloc_operators(id) on delete set null,
  station        text,                                 -- PPMM (província+município)
  province_code  text,
  municipio_code text,
  lat            double precision,
  lng            double precision,
  address        text,
  capacity       integer,                              -- nº compartimentos/caixas ou capacidade
  hours          text,                                 -- horário (texto livre na Fase 1)
  phone          text,
  notes          text,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.net_points enable row level security;
create index if not exists idx_net_points_station  on public.net_points (station);
create index if not exists idx_net_points_operator on public.net_points (operator_id);
create index if not exists idx_net_points_type      on public.net_points (point_type);

-- é gestor? (global ou do operador do ponto)
create or replace function public.net_is_manager(p_operator uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.net_managers m
     where m.user_id = auth.uid()
       and (m.operator_id is null or m.operator_id = p_operator)
  );
$$;

-- Leitura: qualquer utilizador autenticado vê a rede (infraestrutura pública).
drop policy if exists net_points_select_auth on public.net_points;
create policy net_points_select_auth on public.net_points
  for select to authenticated using (true);

-- Escrita: só gestores (global, ou do operador a que o ponto pertence).
drop policy if exists net_points_insert_mgr on public.net_points;
create policy net_points_insert_mgr on public.net_points
  for insert to authenticated with check (public.net_is_manager(operator_id));

drop policy if exists net_points_update_mgr on public.net_points;
create policy net_points_update_mgr on public.net_points
  for update to authenticated using (public.net_is_manager(operator_id))
  with check (public.net_is_manager(operator_id));

drop policy if exists net_points_delete_mgr on public.net_points;
create policy net_points_delete_mgr on public.net_points
  for delete to authenticated using (public.net_is_manager(operator_id));

-- updated_at automático
create or replace function public.net_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_net_points_touch on public.net_points;
create trigger trg_net_points_touch before update on public.net_points
  for each row execute function public.net_touch_updated_at();

-- Bootstrap: o PRIMEIRO utilizador autenticado pode tornar-se gestor global,
-- mas SÓ enquanto não houver nenhum gestor (fecha-se sozinho depois disso).
create or replace function public.net_bootstrap_manager()
returns boolean language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if auth.uid() is null then
    raise exception 'Precisa de sessão iniciada.';
  end if;
  select count(*) into v_count from public.net_managers;
  if v_count > 0 then
    return false; -- já há gestores; bootstrap fechado.
  end if;
  insert into public.net_managers (user_id, operator_id, role)
       values (auth.uid(), null, 'owner');
  return true;
end $$;
grant execute on function public.net_bootstrap_manager() to authenticated;
grant execute on function public.net_is_manager(uuid)   to authenticated;
