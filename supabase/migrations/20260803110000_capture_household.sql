-- CAPTURA DO AGREGADO (decisão 1A): o agente capta o titular + os co-residentes
-- na mesma visita. Liga-se ao modelo de residentes já existente: cada pessoa
-- fica em afroloc_residents por NOME (sem conta), pendente de aprovação da
-- autoridade; ativa depois por OTP. Ver docs/SPEC_REGISTO_EM_NOME_DO_MORADOR.md.

-- Telefone por residente (para o OTP de ativação de cada um).
alter table public.afroloc_residents add column if not exists phone text;

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
  v_ptype text := p->>'property_type';
  v_is_residence boolean := v_ptype in ('house','apartment');
  v_occ text := p->'potential_user'->>'occupancy_title';
  v_rel text := case when v_occ = 'tenant' then 'tenant' else 'owner' end;
  v_id uuid;
  v_res_count int := 0;
  v_cr jsonb;
  v_cr_rel text;
begin
  if not (v_admin or v_isval) then
    raise exception 'forbidden: validator or admin required';
  end if;
  if v_code = '' then raise exception 'code required'; end if;

  -- Jurisdição (validador limitado; admin sem limite).
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
    v_ptype, coalesce(p->>'address_type', 'informal'),
    false, v_authority, auth.uid(), 'pending_validation',
    jsonb_build_object(
      'potential_user', jsonb_build_object(
        'name',  p->'potential_user'->>'name',
        'phone', p->'potential_user'->>'phone',
        'occupancy_title', v_occ),
      'captured_by', auth.uid(),
      'capture_source', 'field_agent',
      'claimable', true,
      'claim_phone', p->'potential_user'->>'phone')
  )
  returning id into v_id;

  -- RESIDENTES (só para residências): titular + agregado, por nome, pendentes
  -- de aprovação da autoridade. Salvaguarda de capacidade (máx. 6 por defeito).
  if v_is_residence and coalesce(p->'potential_user'->>'name','') <> '' then
    insert into public.afroloc_residents
      (afroloc_record_id, user_id, relationship, is_primary, status, full_name, phone)
    values
      (v_id, null, v_rel::resident_relationship, true,
       'pending_authority'::coresident_request_status,
       p->'potential_user'->>'name', p->'potential_user'->>'phone');
    v_res_count := 1;

    for v_cr in select value from jsonb_array_elements(coalesce(p->'co_residents', '[]'::jsonb))
    loop
      exit when v_res_count >= 6; -- respeita o limite do trigger de capacidade
      if coalesce(v_cr->>'name','') = '' then continue; end if;
      v_cr_rel := coalesce(nullif(v_cr->>'relationship',''), 'other_family');
      begin
        insert into public.afroloc_residents
          (afroloc_record_id, user_id, relationship, is_primary, status, full_name, phone)
        values
          (v_id, null, v_cr_rel::resident_relationship, false,
           'pending_authority'::coresident_request_status,
           v_cr->>'name', v_cr->>'phone');
        v_res_count := v_res_count + 1;
      exception when others then
        -- parentesco inválido ou capacidade: ignora este, mantém o resto.
        null;
      end;
    end loop;
  end if;

  insert into public.security_audit_log (action, function_name, user_id, details)
  values ('capture_potential_user', 'capture_potential_user_address', auth.uid(),
    jsonb_build_object('code', v_code, 'record_id', v_id, 'owner', 'authority',
      'potential_user_name', p->'potential_user'->>'name',
      'potential_user_phone', p->'potential_user'->>'phone',
      'residents', v_res_count));

  return jsonb_build_object('ok', true, 'id', v_id, 'code', v_code,
    'status', 'pending_validation', 'residents', v_res_count);
end;
$function$;

grant execute on function public.capture_potential_user_address(jsonb) to authenticated;

notify pgrst, 'reload schema';
