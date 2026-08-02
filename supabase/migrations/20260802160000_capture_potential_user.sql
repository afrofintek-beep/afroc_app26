-- CAPTURA DO POTENCIAL UTILIZADOR (trabalho de campo).
-- Um agente/validador captura os dados de um potencial utilizador; o registo
-- nasce PENDENTE e em nome dele — posse transitória da conta de autoridade,
-- nunca do capturador. O validador depois fiscaliza/valida (certifica).
-- Ver docs/SPEC_REGISTO_EM_NOME_DO_MORADOR.md.

-- ── 1) Exceção ao limite/duplicado para capturas de campo ────────────────────
-- Um registo com registered_by_user_id preenchido é de OUTREM (capturado por um
-- agente). Não deve contar para o limite de 10 nem para o duplicado do dono
-- transitório (a autoridade). A unicidade do código/célula continua a impedir
-- duplicados reais (código idêntico).
create or replace function public.check_afroloc_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_current_count integer;
  v_max_limit integer := 10;
  v_duplicate_exists boolean;
  v_is_privileged boolean;
begin
  select exists (
    select 1 from public.user_roles
    where user_id = NEW.user_id
      and role = any (array['admin','admin_national','admin_province',
                            'admin_municipality','operator_field']::app_role[])
  ) into v_is_privileged;

  if v_is_privileged then
    return NEW;
  end if;

  -- Captura de campo (em nome de um potencial utilizador): isenta.
  if NEW.registered_by_user_id is not null then
    return NEW;
  end if;

  select exists (
    select 1 from public.afroloc_records
    where user_id = NEW.user_id
      and id is distinct from NEW.id
      and country = NEW.country
      and coalesce(geo_lat::text,'') = coalesce(NEW.geo_lat::text,'')
      and coalesce(geo_lon::text,'') = coalesce(NEW.geo_lon::text,'')
      and coalesce(street_name,'') = coalesce(NEW.street_name,'')
      and coalesce(number,'')      = coalesce(NEW.number,'')
      and coalesce(unit,'')        = coalesce(NEW.unit,'')
      and coalesce(property_type,'') = coalesce(NEW.property_type,'')
  ) into v_duplicate_exists;

  if v_duplicate_exists then
    raise exception 'Duplicate address: já existe um endereço seu NESTA mesma célula com este tipo de propriedade. Escolha outra célula (ou um tipo de propriedade diferente).';
  end if;

  select count(*) into v_current_count
  from public.afroloc_records
  where user_id = NEW.user_id;

  if v_current_count >= v_max_limit then
    raise exception 'Maximum limit of % AFROLOC addresses per user exceeded', v_max_limit;
  end if;

  return NEW;
end;
$function$;

-- ── 2) Rede de segurança: o capturador NUNCA é o dono ────────────────────────
-- Um registo captado por um agente (registered_by_user_id preenchido) não pode
-- ter esse mesmo agente como dono. Impede, por construção, que o validador/
-- agente fique dono do que registou para outra pessoa.
create or replace function public.prevent_registrant_ownership()
returns trigger
language plpgsql
as $function$
begin
  if NEW.registered_by_user_id is not null
     and NEW.registered_by_user_id = NEW.user_id then
    raise exception 'quem regista em nome de outro não pode ser o dono do endereço (registered_by_user_id = user_id)';
  end if;
  return NEW;
end;
$function$;

drop trigger if exists trg_prevent_registrant_ownership on public.afroloc_records;
create trigger trg_prevent_registrant_ownership
  before insert or update on public.afroloc_records
  for each row execute function public.prevent_registrant_ownership();

-- ── 3) RPC de captura do potencial utilizador ────────────────────────────────
-- Chamada por um agente de campo/validador (operator_field) ou admin. Cria o
-- registo em nome do potencial utilizador (dono = autoridade), com o capturador
-- em registered_by_user_id, estado PENDENTE, dados do potencial utilizador em
-- metadata e marca de reclamável. Jurisdição verificada (validador limitado).
create or replace function public.capture_potential_user_address(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_admin boolean := public._caller_is_admin();
  v_isval boolean := exists (select 1 from public.user_roles
                             where user_id = auth.uid() and role = 'operator_field');
  v_authority uuid := 'ba9edde7-7f55-4c1d-a179-2ebcd0c7f995'; -- autoridade@afroloc.ao
  v_j1 text; v_j2 text; v_jc text;
  v_code text := upper(regexp_replace(coalesce(p->>'code',''), '\s', '', 'g'));
  v_l1 text := p->>'level1_code';
  v_l2 text := p->>'level2_code';
  v_country text := coalesce(p->>'country', 'AO');
  v_id uuid;
begin
  if not (v_admin or v_isval) then
    raise exception 'forbidden: validator or admin required';
  end if;
  if v_code = '' then raise exception 'code required'; end if;

  -- Jurisdição: o validador só captura na sua área; o admin não tem limite.
  if not v_admin then
    select jurisdiction_level1_code, jurisdiction_level2_code, jurisdiction_country
      into v_j1, v_j2, v_jc
      from public.user_authorization_levels where user_id = auth.uid();
    if v_jc is not null and v_country is not null and upper(v_jc) <> upper(v_country) then
      return jsonb_build_object('ok', false, 'reason', 'fora_do_pais');
    end if;
    if v_j2 is not null then
      if v_l2 is distinct from v_j2 then
        return jsonb_build_object('ok', false, 'reason', 'fora_da_jurisdicao');
      end if;
    elsif v_j1 is not null then
      if v_l1 is distinct from v_j1 then
        return jsonb_build_object('ok', false, 'reason', 'fora_da_jurisdicao');
      end if;
    else
      return jsonb_build_object('ok', false, 'reason', 'sem_jurisdicao');
    end if;
  end if;

  insert into public.afroloc_records (
    code, country,
    level1_code, level1_name, level2_code, level2_name,
    level3_code, level3_name, level4_code, level4_name,
    street_code, street_name, number, unit,
    geo_lat, geo_lon, property_type, address_type,
    is_primary_residence, user_id, registered_by_user_id, status, metadata
  ) values (
    v_code, v_country,
    v_l1, p->>'level1_name', v_l2, p->>'level2_name',
    p->>'level3_code', p->>'level3_name', p->>'level4_code', p->>'level4_name',
    p->>'street_code', p->>'street_name', p->>'number', p->>'unit',
    nullif(p->>'geo_lat','')::numeric, nullif(p->>'geo_lon','')::numeric,
    p->>'property_type', coalesce(p->>'address_type', 'informal'),
    false, v_authority, auth.uid(), 'pending_validation',
    jsonb_build_object(
      'potential_user', jsonb_build_object(
        'name',  p->'potential_user'->>'name',
        'phone', p->'potential_user'->>'phone',
        'occupancy_title', p->'potential_user'->>'occupancy_title'),
      'captured_by', auth.uid(),
      'capture_source', 'field_agent',
      'claimable', true,
      'claim_phone', p->'potential_user'->>'phone')
  )
  returning id into v_id;

  insert into public.security_audit_log (action, function_name, user_id, details)
  values ('capture_potential_user', 'capture_potential_user_address', auth.uid(),
    jsonb_build_object('code', v_code, 'record_id', v_id, 'owner', 'authority',
      'potential_user_name', p->'potential_user'->>'name',
      'potential_user_phone', p->'potential_user'->>'phone'));

  return jsonb_build_object('ok', true, 'id', v_id, 'code', v_code, 'status', 'pending_validation');
end;
$function$;

grant execute on function public.capture_potential_user_address(jsonb) to authenticated;

notify pgrst, 'reload schema';
