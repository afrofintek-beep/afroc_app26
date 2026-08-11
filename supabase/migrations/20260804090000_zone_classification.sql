-- CLASSIFICAÇÃO URBANO/RURAL por município (célula 10m urbana / 25m rural).
-- Antes: metadata.zone_type quase nunca era preenchido → o dashboard mostrava
-- tudo como "rural". Agora um trigger classifica QUALQUER caminho de criação a
-- partir do município (level2_code), num único sítio. Regra confirmada pelo dono.

create or replace function public.set_zone_from_municipio()
returns trigger
language plpgsql
as $function$
declare
  v_urban boolean;
begin
  -- Não sobrepor se já veio classificado (ex.: import com zona explícita).
  if (new.metadata->>'zone_type') is not null then
    return new;
  end if;
  if new.level2_code is null then
    return new; -- fica "por classificar"
  end if;

  v_urban :=
    (new.level1_code = 'AO-LDA' and new.level2_code not in ('AO-LDA-MULENVOS','AO-LDA-MUSSULO'))
    or new.level2_code in (
      'AO-BLA-BENGUELA','AO-BLA-LOBITO','AO-BLA-CATUMBELA',
      'AO-HLA-LUBANGO','AO-HBO-HUAMBO','AO-HBO-CAALA','AO-CSU-SUMBE'
    );

  new.metadata = coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
    'zone_type', case when v_urban then 'urban' else 'rural' end,
    'cell_size', case when v_urban then 10 else 25 end,
    'zone_source', 'municipio');
  return new;
end;
$function$;

drop trigger if exists trg_set_zone_from_municipio on public.afroloc_records;
create trigger trg_set_zone_from_municipio
  before insert on public.afroloc_records
  for each row execute function public.set_zone_from_municipio();

-- Correção do trigger prevent_registrant_ownership (de 20260802160000): passa a
-- disparar SÓ quando as colunas de posse mudam, para não bloquear updates
-- inocentes (ex.: backfill de metadata) sobre linhas legadas onde
-- registered_by_user_id = user_id.
drop trigger if exists trg_prevent_registrant_ownership on public.afroloc_records;
create trigger trg_prevent_registrant_ownership
  before insert or update of user_id, registered_by_user_id on public.afroloc_records
  for each row execute function public.prevent_registrant_ownership();
