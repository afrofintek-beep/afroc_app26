-- Validação ADMINISTRATIVA de um endereço (sem testemunhas).
-- Um admin indica o código AFROLOC e a autoridade certifica-o diretamente.
-- Efeito: status='certified', nível 4, + registo em afroloc_validations com
-- method='authority' — o que torna a morada elegível como TESTEMUNHA (passa os
-- dois gates do AddWitness). É a ferramenta de arranque a frio (opção A),
-- self-service, sem SQL.
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
  v_id   uuid;
  v_dbcode text;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
begin
  -- Só admins.
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin','admin_national','admin_province','admin_municipality')
  ) then
    raise exception 'forbidden: admin role required';
  end if;

  if v_code = '' then
    raise exception 'code required';
  end if;

  select id, code into v_id, v_dbcode
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
           'source', 'authority_admin', 'bootstrap', true,
           'certified_by', 'admin', 'certified_at', now()
         ),
         updated_at          = now()
   where id = v_id;

  -- Registo de validação de autoridade (torna a morada testemunha-elegível).
  if not exists (
    select 1 from public.afroloc_validations
     where afroloc_record_id = v_id and validation_method = 'authority'
  ) then
    insert into public.afroloc_validations (
      afroloc_record_id, validation_method, authority_role,
      authority_signature, notes, expires_at, verified_at
    ) values (
      v_id, 'authority', 'admin_authority',
      auth.uid()::text, p_note, now() + interval '1 year', now()
    );
  end if;

  return jsonb_build_object('found', true, 'code', v_dbcode, 'status', 'certified', 'record_id', v_id);
end;
$$;

grant execute on function public.admin_validate_address(text, text) to authenticated;

notify pgrst, 'reload schema';
