-- ─────────────────────────────────────────────────────────────────────────────
--  MÓDULO CEP + CAIXAS POSTAIS (Imbamba) — autoridade postal (Correios de Angola).
--
--  GOVERNANÇA: ferramenta da inteira responsabilidade dos Correios de Angola,
--  disponibilizada pela AFROLOC (AfroFintek) para uso exclusivo, sob a sua
--  responsabilidade, em condições a acordar. Gate próprio (postal_admins),
--  separado dos net_managers da rede Imbamba.
--
--  CEP é derivado (PPMM-ZZ); aqui dá-se REGISTO/GESTÃO oficial por cima.
--  Caixas Postais em postal_boxes/postal_box_counters (já existentes).
-- ─────────────────────────────────────────────────────────────────────────────

-- Autoridade postal ------------------------------------------------------------
create table if not exists public.postal_admins (
  user_id    uuid primary key,
  role       text not null default 'authority',   -- 'authority' | 'agent'
  note       text,
  added_by   uuid,
  created_at timestamptz not null default now()
);
alter table public.postal_admins enable row level security;
drop policy if exists postal_admins_self on public.postal_admins;
create policy postal_admins_self on public.postal_admins
  for select using (user_id = auth.uid());

create or replace function public.postal_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.postal_admins where user_id = auth.uid());
$$;
grant execute on function public.postal_is_admin() to authenticated;

-- Papel do próprio (a app usa para mostrar/esconder o módulo)
create or replace function public.postal_my_role()
returns jsonb language sql stable security definer set search_path = public as $$
  select (select jsonb_build_object('role', role) from public.postal_admins where user_id = auth.uid() limit 1);
$$;
grant execute on function public.postal_my_role() to authenticated;

-- Bootstrap: o 1.º utilizador torna-se autoridade se ainda não houver nenhuma.
create or replace function public.postal_bootstrap_admin()
returns boolean language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if auth.uid() is null then raise exception 'Precisa de sessão iniciada.'; end if;
  select count(*) into c from public.postal_admins;
  if c > 0 then return false; end if;
  insert into public.postal_admins (user_id, role) values (auth.uid(), 'authority');
  return true;
end $$;
grant execute on function public.postal_bootstrap_admin() to authenticated;

-- Registo oficial de estações (metadados sobre o CEP derivado) ------------------
create table if not exists public.postal_stations (
  station        text primary key,                 -- PPMM
  province_code  text,
  municipio_code text,
  name           text,                              -- nome oficial da estação
  status         text not null default 'active',    -- active|planned|inactive
  notes          text,
  updated_by     uuid default auth.uid(),
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
alter table public.postal_stations enable row level security;
-- Leitura: autenticados (infra pública). Escrita: só autoridade postal.
drop policy if exists postal_stations_read on public.postal_stations;
create policy postal_stations_read on public.postal_stations
  for select to authenticated using (true);
drop policy if exists postal_stations_write on public.postal_stations;
create policy postal_stations_write on public.postal_stations
  for all to authenticated using (public.postal_is_admin()) with check (public.postal_is_admin());

create or replace function public.postal_touch()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_postal_stations_touch on public.postal_stations;
create trigger trg_postal_stations_touch before update on public.postal_stations
  for each row execute function public.postal_touch();

-- Caixas Postais: etiqueta institucional (as tabelas base já existem) -----------
alter table public.postal_boxes add column if not exists label text;

-- Ocupação de uma estação (contadores + total) — só autoridade.
create or replace function public.postal_station_occupancy(p_station text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare std int; prem int; total int;
begin
  if not public.postal_is_admin() then raise exception 'Sem permissão (autoridade postal).'; end if;
  select next_number into std  from public.postal_box_counters where station = p_station and tier = 'standard';
  select next_number into prem from public.postal_box_counters where station = p_station and tier = 'premium';
  select count(*) into total from public.postal_boxes where station = p_station;
  return jsonb_build_object(
    'standard_next', coalesce(std, 10000),
    'premium_next',  coalesce(prem, 100),
    'total', total
  );
end $$;
grant execute on function public.postal_station_occupancy(text) to authenticated;

-- Listar caixas de uma estação — só autoridade (postal_boxes é RLS só-dono).
create or replace function public.postal_admin_boxes(p_station text)
returns setof public.postal_boxes language plpgsql security definer set search_path = public as $$
begin
  if not public.postal_is_admin() then raise exception 'Sem permissão (autoridade postal).'; end if;
  return query select * from public.postal_boxes where station = p_station order by box_number;
end $$;
grant execute on function public.postal_admin_boxes(text) to authenticated;

-- Reservar uma caixa institucional específica (ex.: 00001–00099) — só autoridade.
create or replace function public.postal_reserve_box(p_station text, p_number text, p_label text default null)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.postal_is_admin() then raise exception 'Sem permissão (autoridade postal).'; end if;
  if p_station is null or length(p_station) <> 4 then raise exception 'Estação inválida (esperado PPMM).'; end if;
  if p_number !~ '^[0-9]{5}$' then raise exception 'O número da caixa deve ter 5 dígitos.'; end if;
  insert into public.postal_boxes (station, box_number, tier, owner_id, entity_id, label)
       values (p_station, p_number, 'premium', null, null, p_label);  -- owner nulo = institucional
  return p_number;
exception when unique_violation then
  raise exception 'A caixa % já está atribuída na estação %.', p_number, p_station;
end $$;
grant execute on function public.postal_reserve_box(text, text, text) to authenticated;
