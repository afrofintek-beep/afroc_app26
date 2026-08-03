-- ATIVAÇÃO DO RESIDENTE (Fase 2 parte 2).
-- (a) A certificação do validador aprova (authority) os residentes captados.
-- (b) O residente ativa por OTP no telefone captado: liga a sua conta (user_id)
--     e, se for o TITULAR, a posse do endereço transita da autoridade para ele.
-- Ver docs/SPEC_REGISTO_EM_NOME_DO_MORADOR.md.
-- ⚠️ Entrega do OTP por SMS depende de saldo Infobip (ver memória sms-credits);
--    o mecanismo fica pronto e o OTP nunca é devolvido ao cliente.

-- ── (a) validator_certify_address: aprovar os residentes do endereço ─────────
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

  -- Aprovação da autoridade sobre os residentes captados deste endereço.
  update public.afroloc_residents
     set status = case when status='pending_authority'
                       then 'approved'::coresident_request_status else status end,
         authority_approved_at = now(),
         authority_approved_by_user_id = auth.uid(),
         authority_role = v_role,
         updated_at = now()
   where afroloc_record_id = v_id
     and status = 'pending_authority';

  insert into public.security_audit_log (action, function_name, user_id, details)
  values ('validator_certify_address','validator_certify_address', auth.uid(),
    jsonb_build_object('code',v_code,'record_id',v_id,'previous_status',v_prev,
      'new_status','certified','role',v_role,'validated_at',now()::text));

  return jsonb_build_object('found', true, 'allowed', true, 'code', v_code, 'status','certified');
end $$;
grant execute on function public.validator_certify_address(text,text) to authenticated;

-- ── (b1) Pedir OTP de ativação ───────────────────────────────────────────────
-- O utilizador (já com conta) indica o código do endereço e o telefone que o
-- agente captou; se houver um residente captado (sem conta) com esse telefone,
-- gera-se um OTP. NUNCA se devolve o OTP ao cliente (entrega por SMS).
create or replace function public.resident_start_activation(p_afroloc_code text, p_phone text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_norm text := upper(regexp_replace(coalesce(p_afroloc_code,''),'\s','','g'));
  v_phone text := regexp_replace(coalesce(p_phone,''),'\D','','g');
  v_rec uuid; v_res uuid; v_otp text; v_primary boolean;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if v_phone = '' then return jsonb_build_object('ok', false, 'reason', 'telefone_em_falta'); end if;

  select id into v_rec from public.afroloc_records
    where upper(replace(code,' ',''))=v_norm limit 1;
  if v_rec is null then return jsonb_build_object('ok', false, 'reason', 'endereco_nao_encontrado'); end if;

  select id, is_primary into v_res, v_primary from public.afroloc_residents
    where afroloc_record_id = v_rec
      and user_id is null
      and regexp_replace(coalesce(phone,''),'\D','','g') = v_phone
    limit 1;
  if v_res is null then return jsonb_build_object('ok', false, 'reason', 'residente_nao_encontrado'); end if;

  v_otp := lpad((floor(random()*1000000))::int::text, 6, '0');
  update public.afroloc_residents
     set otp_code = v_otp, otp_expires_at = now() + interval '10 minutes',
         otp_attempts = 0, updated_at = now()
   where id = v_res;

  -- TODO(entrega): enviar v_otp por SMS ao telefone captado quando houver saldo.
  return jsonb_build_object('ok', true, 'resident_id', v_res, 'is_primary', v_primary);
end $$;
grant execute on function public.resident_start_activation(text,text) to authenticated;

-- ── (b2) Confirmar OTP → ligar conta e (se titular) transferir posse ─────────
create or replace function public.resident_confirm_activation(p_resident_id uuid, p_otp text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid := auth.uid();
  v_res public.afroloc_residents%rowtype;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select * into v_res from public.afroloc_residents where id = p_resident_id;
  if v_res.id is null then return jsonb_build_object('ok', false, 'reason', 'nao_encontrado'); end if;
  if v_res.user_id is not null then return jsonb_build_object('ok', false, 'reason', 'ja_ativado'); end if;
  if v_res.otp_code is null or v_res.otp_expires_at is null or v_res.otp_expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'otp_expirado');
  end if;
  if coalesce(v_res.otp_attempts,0) >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'tentativas_excedidas');
  end if;
  if v_res.otp_code <> coalesce(p_otp,'') then
    update public.afroloc_residents set otp_attempts = coalesce(otp_attempts,0)+1 where id = p_resident_id;
    return jsonb_build_object('ok', false, 'reason', 'otp_invalido');
  end if;

  -- OTP válido: liga a conta ao residente.
  update public.afroloc_residents
     set user_id = v_uid,
         status = 'approved'::coresident_request_status,
         otp_code = null, otp_expires_at = null,
         valid_from = coalesce(valid_from, now()), updated_at = now()
   where id = p_resident_id;

  -- Titular: a posse do endereço transita da autoridade para ele.
  if v_res.is_primary then
    update public.afroloc_records
       set user_id = v_uid, updated_at = now(),
           metadata = (coalesce(metadata,'{}'::jsonb) - 'claimable' - 'claim_phone')
                      || jsonb_build_object('activated_by', v_uid::text, 'activated_at', now()::text)
     where id = v_res.afroloc_record_id;
  end if;

  insert into public.security_audit_log (action, function_name, user_id, details)
  values ('resident_activation','resident_confirm_activation', v_uid,
    jsonb_build_object('resident_id', p_resident_id, 'record_id', v_res.afroloc_record_id,
      'is_primary', v_res.is_primary));

  return jsonb_build_object('ok', true, 'is_primary', v_res.is_primary,
    'record_id', v_res.afroloc_record_id);
end $$;
grant execute on function public.resident_confirm_activation(uuid,text) to authenticated;

notify pgrst, 'reload schema';
