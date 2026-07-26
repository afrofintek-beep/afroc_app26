-- ─────────────────────────────────────────────────────────────────────────────
--  ESTAÇÃO POSTAL: 4 → 7 dígitos (dígitos com significado).
--
--  A estação passa de PPMM (4 díg.) para R·PP·MM·CC (7 díg.), onde:
--    R  = macro-região (1 Norte · 2 Centro · 3 Sul · 4 Leste · 5 Oeste)
--    PP = província (01–21, Lei 14/24)   MM = município   CC = comuna (00 = sede)
--
--  A Caixa Postal continua sequencial e atómica por estação+nível; muda apenas o
--  comprimento/validação da estação. Caixas já emitidas (estação de 4 díg.) ficam
--  intactas — os contadores são por estação, não há colisão. Ver src/lib/postal.ts
--  e src/data/comunas.json (mapeamento oficial validado 21/326/378).
-- ─────────────────────────────────────────────────────────────────────────────

-- Aloca a PRÓXIMA caixa postal livre para (estação, nível) de forma atómica.
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
  if p_station is null or p_station !~ '^[0-9]{7}$' then
    raise exception 'Estação inválida (esperado R·PP·MM·CC, 7 dígitos).';
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

-- Reserva de caixa institucional específica (00001–00099) — só autoridade.
create or replace function public.postal_reserve_box(p_station text, p_number text, p_label text default null)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.postal_is_admin() then raise exception 'Sem permissão (autoridade postal).'; end if;
  if p_station is null or p_station !~ '^[0-9]{7}$' then raise exception 'Estação inválida (esperado R·PP·MM·CC, 7 dígitos).'; end if;
  if p_number !~ '^[0-9]{5}$' then raise exception 'O número da caixa deve ter 5 dígitos.'; end if;
  insert into public.postal_boxes (station, box_number, tier, owner_id, entity_id, label)
       values (p_station, p_number, 'premium', null, null, p_label);  -- owner nulo = institucional
  return p_number;
exception when unique_violation then
  raise exception 'A caixa % já está atribuída na estação %.', p_number, p_station;
end $$;
grant execute on function public.postal_reserve_box(text, text, text) to authenticated;
