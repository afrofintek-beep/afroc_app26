-- Auditoria da validação administrativa: regista QUEM validou, com que NÍVEL de
-- autorização, QUANDO, o código, e o estado antes→depois — em security_audit_log
-- (a mesma tabela que a página "Logs de Auditoria" mostra). Também grava o papel
-- real do admin no próprio registo de validação (afroloc_validations.authority_role).
create or replace function public.admin_validate_address(
  p_code text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_dbcode text;
  v_prev   text;
  v_code   text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_roles  text[];
  v_role   text;
begin
  -- Papéis do chamador.
  select array_agg(role::text) into v_roles
    from public.user_roles where user_id = auth.uid();

  if v_roles is null
     or not (v_roles && array['admin','admin_national','admin_province','admin_municipality']) then
    raise exception 'forbidden: admin role required';
  end if;

  -- Papel de admin mais relevante (para auditoria), por prioridade.
  v_role := coalesce(
    (select r from unnest(array['admin_national','admin','admin_province','admin_municipality']) r
      where r = any(v_roles) limit 1),
    v_roles[1]
  );

  if v_code = '' then raise exception 'code required'; end if;

  select id, code, status::text into v_id, v_dbcode, v_prev
    from public.afroloc_records
   where upper(replace(code, ' ', '')) = v_code
   limit 1;

  if v_id is null then
    return jsonb_build_object('found', false);
  end if;

  update public.afroloc_records
     set status              = 'certified',
         certification_level = greatest(coalesce(certification_level, 0), 4),
         approved_at         = now(),
         approved_by_user_id = auth.uid(),
         ats_breakdown       = coalesce(ats_breakdown, '{}'::jsonb) || jsonb_build_object(
           'source', 'authority_admin', 'bootstrap', true, 'certified_by', 'admin',
           'certified_by_user_id', auth.uid(), 'certified_by_role', v_role, 'certified_at', now()
         ),
         updated_at          = now()
   where id = v_id;

  if not exists (
    select 1 from public.afroloc_validations
     where afroloc_record_id = v_id and validation_method = 'authority'
  ) then
    insert into public.afroloc_validations (
      afroloc_record_id, validation_method, authority_role,
      authority_signature, notes, expires_at, verified_at
    ) values (
      v_id, 'authority', v_role,      -- papel REAL do admin (auditoria)
      auth.uid()::text, p_note, now() + interval '1 year', now()
    );
  end if;

  -- Registo de AUDITORIA (quem/nível/quando/o quê/antes→depois).
  insert into public.security_audit_log (action, function_name, user_id, details)
  values (
    'admin_validate_address', 'admin_validate_address', auth.uid(),
    jsonb_build_object(
      'code', v_dbcode,
      'record_id', v_id,
      'previous_status', v_prev,
      'new_status', 'certified',
      'certification_level', 4,
      'admin_role', v_role,
      'admin_roles', to_jsonb(v_roles),
      'note', p_note,
      'validated_at', now()
    )
  );

  return jsonb_build_object(
    'found', true, 'code', v_dbcode, 'status', 'certified',
    'record_id', v_id, 'admin_role', v_role
  );
end;
$$;

grant execute on function public.admin_validate_address(text, text) to authenticated;

-- Registo de auditoria do backfill inicial das 39 âncoras (feito na sessão de
-- setup). Idempotente: só insere se ainda não existir.
insert into public.security_audit_log (action, function_name, user_id, details)
select 'bulk_authority_validation_backfill', 'admin_validate_address', null,
  jsonb_build_object(
    'note', 'Backfill: validacao de autoridade adicionada as ancoras-genese certificadas sem validacao',
    'count', 39, 'by', 'bootstrap_admin (sessao de setup 2026-07-28)', 'at', now()
  )
where not exists (
  select 1 from public.security_audit_log where action = 'bulk_authority_validation_backfill'
);

notify pgrst, 'reload schema';
