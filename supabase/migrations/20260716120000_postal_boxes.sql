-- ─────────────────────────────────────────────────────────────────────────────
--  CAIXA POSTAL / APARTADO — número sequencial por estação, com blocos por nível.
--  Parte B do sistema postal AFROLOC. A alocação é ATÓMICA (contador por
--  estação+nível), à prova de colisões entre utilizadores concorrentes.
--
--  Estação = PPMM (província+município). Blocos por nível:
--    standard → 10000–99999 (sequencial automático)
--    premium  → 00100–09999 (números baixos/memoráveis — valor acrescentado)
--    00001–00099 = institucional (reservado — não atribuído por esta função)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.postal_boxes (
  id          uuid primary key default gen_random_uuid(),
  station     text not null,                                   -- PPMM, ex.: "0515"
  box_number  text not null,                                   -- 5 dígitos, ex.: "10001"
  tier        text not null check (tier in ('standard','premium')),
  owner_id    uuid,                                            -- dono (auth.uid)
  entity_id   uuid,                                            -- morada/identidade associada (opcional)
  created_at  timestamptz not null default now(),
  unique (station, box_number)
);
alter table public.postal_boxes enable row level security;
create index if not exists idx_postal_boxes_owner on public.postal_boxes (owner_id);

-- O dono vê/gere apenas as suas caixas. (Escrita só via RPC SECURITY DEFINER.)
drop policy if exists "postal_boxes_select_own" on public.postal_boxes;
create policy "postal_boxes_select_own" on public.postal_boxes
  for select using (owner_id = auth.uid());

-- Contador atómico por estação+nível.
create table if not exists public.postal_box_counters (
  station     text not null,
  tier        text not null check (tier in ('standard','premium')),
  next_number int  not null,
  primary key (station, tier)
);
alter table public.postal_box_counters enable row level security;  -- sem policies: só service_role/RPC

-- Aloca a PRÓXIMA caixa postal livre para (estação, nível) de forma atómica.
-- Devolve o número (5 dígitos). Reutiliza uma caixa já existente do próprio
-- para a mesma estação+nível (não atribui duplicados ao mesmo dono).
create or replace function public.allocate_postal_box(
  p_station text,
  p_tier    text,
  p_entity  uuid default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start int;
  v_end   int;
  v_num   int;
  v_box   text;
  v_existing text;
begin
  if p_station is null or length(p_station) <> 4 then
    raise exception 'Estação inválida (esperado PPMM).';
  end if;
  if p_tier not in ('standard','premium') then
    raise exception 'Nível inválido: %', p_tier;
  end if;

  -- Já tem uma caixa nesta estação+nível? devolve a mesma (idempotente por dono).
  select box_number into v_existing
    from postal_boxes
   where owner_id = auth.uid() and station = p_station and tier = p_tier
   limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  if p_tier = 'premium' then v_start := 100;   v_end := 9999;
  else                       v_start := 10000; v_end := 99999; end if;

  -- Incremento atómico: upsert do contador (o UPDATE bloqueia a linha).
  insert into postal_box_counters (station, tier, next_number)
       values (p_station, p_tier, v_start + 1)
  on conflict (station, tier)
       do update set next_number = postal_box_counters.next_number + 1
  returning next_number - 1 into v_num;

  if v_num > v_end then
    raise exception 'Bloco de caixas postais esgotado para % (%).', p_station, p_tier;
  end if;

  v_box := lpad(v_num::text, 5, '0');
  insert into postal_boxes (station, box_number, tier, owner_id, entity_id)
       values (p_station, v_box, p_tier, auth.uid(), p_entity);
  return v_box;
end;
$$;

grant execute on function public.allocate_postal_box(text, text, uuid) to authenticated;
