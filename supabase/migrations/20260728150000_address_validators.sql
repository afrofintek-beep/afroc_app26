-- ============================================================
-- VALIDADOR DE ENDEREÇOS (agente de terreno)
-- Papel = operator_field (reutilizado). Regista + valida endereços de forma
-- CÉLERE, SÓ na sua jurisdição, e a validação CERTIFICA (nível 4). Tudo auditado.
-- ============================================================

-- Helper: papéis de admin do chamador
create or replace function public._caller_is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin','admin_national','admin_province','admin_municipality')
  );
$$;

-- 1) ADMIN nomeia um validador: dá papel operator_field + jurisdição -----------
create or replace function public.assign_address_validator(
  p_email       text,
  p_level1_code text default null, p_level1_name text default null,
  p_level2_code text default null, p_level2_name text default null,
  p_country     text default 'AO'
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_uid uuid;
begin
  if not public._caller_is_admin() then raise exception 'forbidden: admin role required'; end if;

  select id into v_uid from auth.users where lower(email)=lower(trim(p_email));
  if v_uid is null then return jsonb_build_object('found', false); end if;

  -- papel operator_field
  insert into public.user_roles (user_id, role)
  select v_uid, 'operator_field'
  where not exists (select 1 from public.user_roles where user_id=v_uid and role='operator_field');

  -- jurisdição + marca de validador (sem tocar em current_level p/ não dar menu de admin)
  insert into public.user_authorization_levels (
    user_id, current_level, administrative_role, jurisdiction_country,
    jurisdiction_level1_code, jurisdiction_level1_name,
    jurisdiction_level2_code, jurisdiction_level2_name, assigned_by_user_id, assigned_at
  ) values (
    v_uid, 1, 'operator_field', p_country,
    p_level1_code, p_level1_name, p_level2_code, p_level2_name, auth.uid(), now()
  )
  on conflict (user_id) do update set
    administrative_role      = 'operator_field',
    jurisdiction_country     = excluded.jurisdiction_country,
    jurisdiction_level1_code = excluded.jurisdiction_level1_code,
    jurisdiction_level1_name = excluded.jurisdiction_level1_name,
    jurisdiction_level2_code = excluded.jurisdiction_level2_code,
    jurisdiction_level2_name = excluded.jurisdiction_level2_name,
    assigned_by_user_id      = auth.uid(),
    updated_at               = now();

  insert into public.security_audit_log (action, function_name, user_id, details)
  values ('assign_address_validator','assign_address_validator', v_uid,
    jsonb_build_object('email',p_email,'country',p_country,
      'level1',p_level1_name,'level2',p_level2_name,'by',auth.uid(),'at',now()::text));

  return jsonb_build_object('found', true, 'email', p_email,
    'jurisdiction', coalesce(p_level2_name, p_level1_name, p_country));
end $$;
grant execute on function public.assign_address_validator(text,text,text,text,text,text) to authenticated;

-- 2) ADMIN revoga um validador ------------------------------------------------
create or replace function public.revoke_address_validator(p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public._caller_is_admin() then raise exception 'forbidden: admin role required'; end if;
  delete from public.user_roles where user_id=p_user_id and role='operator_field';
  update public.user_authorization_levels
     set administrative_role=null,
         jurisdiction_level1_code=null, jurisdiction_level1_name=null,
         jurisdiction_level2_code=null, jurisdiction_level2_name=null,
         updated_at=now()
   where user_id=p_user_id;
  insert into public.security_audit_log (action, function_name, user_id, details)
  values ('revoke_address_validator','revoke_address_validator', p_user_id,
    jsonb_build_object('by',auth.uid(),'at',now()::text));
end $$;
grant execute on function public.revoke_address_validator(uuid) to authenticated;

-- 3) VALIDADOR certifica um endereço (só na sua jurisdição) --------------------
create or replace function public.validator_certify_address(p_code text, p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_admin boolean := public._caller_is_admin();
  v_isval boolean := exists (select 1 from public.user_roles where user_id=auth.uid() and role='operator_field');
  v_j1 text; v_j2 text; v_jc text; v_role text;
  v_id uuid; v_code text; v_prev text; v_l1 text; v_l2 text; v_country text;
  v_norm text := upper(regexp_replace(coalesce(p_code,''),'\s','','g'));
begin
  if not (v_admin or v_isval) then raise exception 'forbidden: validator or admin required'; end if;
  if v_norm='' then raise exception 'code required'; end if;

  select id, code, status::text, level1_code, level2_code, country
    into v_id, v_code, v_prev, v_l1, v_l2, v_country
    from public.afroloc_records where upper(replace(code,' ',''))=v_norm limit 1;
  if v_id is null then return jsonb_build_object('found', false); end if;

  -- Verificação de JURISDIÇÃO (só para validadores; admins não têm limite).
  if not v_admin then
    select jurisdiction_level1_code, jurisdiction_level2_code, jurisdiction_country
      into v_j1, v_j2, v_jc
      from public.user_authorization_levels where user_id=auth.uid();
    if v_jc is not null and v_country is not null and upper(v_jc) <> upper(v_country) then
      return jsonb_build_object('found', true, 'allowed', false, 'reason', 'fora_do_pais', 'code', v_code);
    end if;
    if v_j2 is not null then
      if v_l2 is distinct from v_j2 then
        return jsonb_build_object('found', true, 'allowed', false, 'reason', 'fora_da_jurisdicao', 'code', v_code);
      end if;
    elsif v_j1 is not null then
      if v_l1 is distinct from v_j1 then
        return jsonb_build_object('found', true, 'allowed', false, 'reason', 'fora_da_jurisdicao', 'code', v_code);
      end if;
    else
      return jsonb_build_object('found', true, 'allowed', false, 'reason', 'sem_jurisdicao', 'code', v_code);
    end if;
  end if;

  v_role := case when v_admin then 'admin' else 'operator_field' end;

  update public.afroloc_records
     set status='certified',
         certification_level=greatest(coalesce(certification_level,0),4),
         approved_at=now(), approved_by_user_id=auth.uid(),
         ats_breakdown = coalesce(ats_breakdown,'{}'::jsonb) || jsonb_build_object(
           'source','authority_field','certified_by_role',v_role,
           'certified_by_user_id',auth.uid(),'certified_at',now()),
         updated_at=now()
   where id=v_id;

  if not exists (select 1 from public.afroloc_validations where afroloc_record_id=v_id and validation_method='authority') then
    insert into public.afroloc_validations (afroloc_record_id, validation_method, authority_role, authority_signature, notes, expires_at, verified_at)
    values (v_id,'authority', v_role, auth.uid()::text, p_note, now()+interval '1 year', now());
  end if;

  insert into public.security_audit_log (action, function_name, user_id, details)
  values ('validator_certify_address','validator_certify_address', auth.uid(),
    jsonb_build_object('code',v_code,'record_id',v_id,'previous_status',v_prev,
      'new_status','certified','role',v_role,'validated_at',now()::text));

  return jsonb_build_object('found', true, 'allowed', true, 'code', v_code, 'status','certified');
end $$;
grant execute on function public.validator_certify_address(text,text) to authenticated;

-- 4) Listar validadores (admin) ----------------------------------------------
create or replace function public.list_address_validators()
returns table(user_id uuid, email text, full_name text, jurisdiction text, assigned_at timestamptz)
language sql security definer set search_path=public as $$
  select l.user_id, u.email, p.full_name,
    coalesce(l.jurisdiction_level2_name, l.jurisdiction_level1_name, l.jurisdiction_country) as jurisdiction,
    l.assigned_at
  from public.user_authorization_levels l
  join auth.users u on u.id = l.user_id
  left join public.profiles p on p.user_id = l.user_id
  where l.administrative_role = 'operator_field'
    and public._caller_is_admin()
  order by l.assigned_at desc nulls last;
$$;
grant execute on function public.list_address_validators() to authenticated;

notify pgrst, 'reload schema';
