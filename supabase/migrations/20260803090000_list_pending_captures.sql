-- FISCALIZAÇÃO: lista os endereços PENDENTES de validação na jurisdição do
-- validador (ou todos, para admin). Alimenta o painel de acompanhamento em
-- /validate-address, onde o validador revê e certifica os registos captados.
-- Ver docs/SPEC_REGISTO_EM_NOME_DO_MORADOR.md (Fase 2).

create or replace function public.list_pending_captures()
returns table (
  id uuid,
  code text,
  level1_name text,
  level2_name text,
  level3_name text,
  property_type text,
  potential_user_name text,
  potential_user_phone text,
  occupancy_title text,
  registered_by_user_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_admin boolean := public._caller_is_admin();
  v_isval boolean := exists (select 1 from public.user_roles
                             where user_id = auth.uid() and role = 'operator_field');
  v_j1 text; v_j2 text; v_jc text;
begin
  if not (v_admin or v_isval) then
    raise exception 'forbidden: validator or admin required';
  end if;

  if not v_admin then
    select jurisdiction_level1_code, jurisdiction_level2_code, jurisdiction_country
      into v_j1, v_j2, v_jc
      from public.user_authorization_levels where user_id = auth.uid();
  end if;

  return query
  select
    r.id, r.code, r.level1_name, r.level2_name, r.level3_name, r.property_type,
    r.metadata->'potential_user'->>'name'            as potential_user_name,
    r.metadata->'potential_user'->>'phone'           as potential_user_phone,
    r.metadata->'potential_user'->>'occupancy_title' as occupancy_title,
    r.registered_by_user_id,
    r.created_at
  from public.afroloc_records r
  where r.status = 'pending_validation'
    and (
      v_admin
      or (v_jc is not null and upper(r.country) = upper(v_jc)
          and (
            (v_j2 is not null and r.level2_code = v_j2)
            or (v_j2 is null and v_j1 is not null and r.level1_code = v_j1)
          ))
      or (v_jc is null and (
            (v_j2 is not null and r.level2_code = v_j2)
            or (v_j2 is null and v_j1 is not null and r.level1_code = v_j1)
          ))
    )
  order by r.created_at desc
  limit 200;
end;
$function$;

grant execute on function public.list_pending_captures() to authenticated;

notify pgrst, 'reload schema';
