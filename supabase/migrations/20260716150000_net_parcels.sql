-- ─────────────────────────────────────────────────────────────────────────────
--  REDE DE DISTRIBUIÇÃO/RECOLHA (IMBAMBA) — Fase 2: ciclo da encomenda.
--
--  Uma encomenda entra na rede → roteia-se pela ESTAÇÃO PPMM do destino (do CEP)
--  → chega a um Ponto Imbamba → destinatário é notificado → RECOLHA com OTP.
--  Estados: registered → in_transit → arrived → collected (ou returned).
--
--  Backend partilhado com a app AFROLOC (ljcx). Depende de net_points (Fase 1).
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.net_parcel_status as enum
    ('registered','in_transit','arrived','collected','returned');
exception when duplicate_object then null; end $$;

create table if not exists public.net_parcels (
  id                 uuid primary key default gen_random_uuid(),
  tracking_code      text unique not null,
  operator_id        uuid references public.afroloc_operators(id) on delete set null,
  recipient_name     text not null,
  recipient_contact  text,                       -- telefone/email p/ notificação
  dest_afroloc_code  text,                        -- código AFROLOC do destino (opcional)
  dest_station       text,                        -- PPMM (província+município)
  province_code      text,
  municipio_code     text,
  point_id           uuid references public.net_points(id) on delete set null, -- Ponto Imbamba
  status             public.net_parcel_status not null default 'registered',
  weight_g           integer,
  size               text,
  notes              text,
  pickup_otp         text,                        -- gerado ao chegar
  pickup_otp_expires timestamptz,
  notified_at        timestamptz,
  collected_at       timestamptz,
  collected_by       text,                        -- nome de quem levantou
  created_by         uuid default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.net_parcels enable row level security;
create index if not exists idx_net_parcels_status  on public.net_parcels (status);
create index if not exists idx_net_parcels_station on public.net_parcels (dest_station);
create index if not exists idx_net_parcels_point    on public.net_parcels (point_id);

create table if not exists public.net_parcel_events (
  id         uuid primary key default gen_random_uuid(),
  parcel_id  uuid not null references public.net_parcels(id) on delete cascade,
  status     public.net_parcel_status,
  note       text,
  at         timestamptz not null default now(),
  by         uuid default auth.uid()
);
alter table public.net_parcel_events enable row level security;
create index if not exists idx_net_parcel_events_parcel on public.net_parcel_events (parcel_id, at);

-- RLS: gestores da rede gerem as encomendas (âmbito do operador da encomenda). --
drop policy if exists net_parcels_select_mgr on public.net_parcels;
create policy net_parcels_select_mgr on public.net_parcels
  for select to authenticated using (public.net_is_manager(operator_id));

drop policy if exists net_parcels_insert_mgr on public.net_parcels;
create policy net_parcels_insert_mgr on public.net_parcels
  for insert to authenticated with check (public.net_is_manager(operator_id));

drop policy if exists net_parcels_update_mgr on public.net_parcels;
create policy net_parcels_update_mgr on public.net_parcels
  for update to authenticated using (public.net_is_manager(operator_id))
  with check (public.net_is_manager(operator_id));

drop policy if exists net_parcels_delete_mgr on public.net_parcels;
create policy net_parcels_delete_mgr on public.net_parcels
  for delete to authenticated using (public.net_is_manager(operator_id));

-- eventos: leitura a gestores da encomenda; escrita só via RPC (SECURITY DEFINER).
drop policy if exists net_parcel_events_select_mgr on public.net_parcel_events;
create policy net_parcel_events_select_mgr on public.net_parcel_events
  for select to authenticated using (
    exists (select 1 from public.net_parcels p
             where p.id = parcel_id and public.net_is_manager(p.operator_id))
  );

-- updated_at automático (reutiliza net_touch_updated_at da Fase 1)
drop trigger if exists trg_net_parcels_touch on public.net_parcels;
create trigger trg_net_parcels_touch before update on public.net_parcels
  for each row execute function public.net_touch_updated_at();

-- Avançar o estado de uma encomenda + registar evento. Ao CHEGAR gera OTP de recolha.
create or replace function public.net_parcel_advance(p_id uuid, p_to public.net_parcel_status, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_op uuid; v_otp text := null;
begin
  select operator_id into v_op from net_parcels where id = p_id;
  if not found then raise exception 'Encomenda inexistente.'; end if;
  if not net_is_manager(v_op) then raise exception 'Sem permissão (não é gestor).'; end if;

  if p_to = 'arrived' then
    v_otp := lpad((floor(random() * 1000000))::int::text, 6, '0');
    update net_parcels set status = p_to, pickup_otp = v_otp,
           pickup_otp_expires = now() + interval '30 days', notified_at = now()
     where id = p_id;
  elsif p_to = 'collected' then
    raise exception 'Use net_parcel_collect para registar a recolha (exige OTP).';
  else
    update net_parcels set status = p_to where id = p_id;
  end if;

  insert into net_parcel_events (parcel_id, status, note) values (p_id, p_to, p_note);
  return jsonb_build_object('status', p_to, 'otp', v_otp);
end $$;

-- Recolha: verifica o OTP e marca como recolhida (prova de entrega).
create or replace function public.net_parcel_collect(p_id uuid, p_otp text, p_by text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_op uuid; v_otp text; v_exp timestamptz; v_status public.net_parcel_status;
begin
  select operator_id, pickup_otp, pickup_otp_expires, status
    into v_op, v_otp, v_exp, v_status from net_parcels where id = p_id;
  if not found then raise exception 'Encomenda inexistente.'; end if;
  if not net_is_manager(v_op) then raise exception 'Sem permissão (não é gestor).'; end if;
  if v_status <> 'arrived' then raise exception 'A encomenda não está no ponto (estado: %).', v_status; end if;
  if v_otp is null or v_otp <> p_otp then raise exception 'Código de recolha inválido.'; end if;
  if v_exp is not null and v_exp < now() then raise exception 'Código de recolha expirado.'; end if;

  update net_parcels set status = 'collected', collected_at = now(),
         collected_by = p_by, pickup_otp = null, pickup_otp_expires = null
   where id = p_id;
  insert into net_parcel_events (parcel_id, status, note)
       values (p_id, 'collected', coalesce('Recolhida por ' || p_by, 'Recolhida'));
  return true;
end $$;

grant execute on function public.net_parcel_advance(uuid, public.net_parcel_status, text) to authenticated;
grant execute on function public.net_parcel_collect(uuid, text, text) to authenticated;
