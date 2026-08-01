-- Pré-autorização de endereços AFROLOC (allowlist) + resgate pelo cidadão.
-- MODELO: a AUTORIDADE autoriza (decisão de confiança), o CIDADÃO ativa (resgate).
-- Complementa a validação administrativa (admin_validate_address) tirando o
-- gargalo do admin: em vez de o admin certificar cada um, autoriza o endereço e
-- o próprio dono resgata no campo da ficha. Idempotente (pode correr 2x).

create table if not exists public.afroloc_preauthorizations (
  id uuid primary key default gen_random_uuid(),
  afroloc_code text not null,
  code_norm text generated always as (upper(regexp_replace(afroloc_code, '\s', '', 'g'))) stored,
  authorized_by uuid references auth.users(id),
  authority_role text,
  validation_phone_number_id uuid references public.validation_phone_numbers(id),
  granted_level int not null default 4,
  note text,
  status text not null default 'authorized' check (status in ('authorized','redeemed','revoked')),
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id)
);

-- Só uma autorização ATIVA por código.
create unique index if not exists ux_preauth_code_active
  on public.afroloc_preauthorizations (code_norm) where status = 'authorized';
create index if not exists ix_preauth_status on public.afroloc_preauthorizations (status);

alter table public.afroloc_preauthorizations enable row level security;

-- Admins/autoridades gerem tudo.
drop policy if exists preauth_admin_all on public.afroloc_preauthorizations;
create policy preauth_admin_all on public.afroloc_preauthorizations
  for all to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid()
                 and ur.role in ('admin','admin_national','admin_province','admin_municipality')))
  with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid()
                 and ur.role in ('admin','admin_national','admin_province','admin_municipality')));

-- O dono do endereço vê a sua pré-autorização.
drop policy if exists preauth_owner_select on public.afroloc_preauthorizations;
create policy preauth_owner_select on public.afroloc_preauthorizations
  for select to authenticated
  using (exists (select 1 from public.afroloc_records r
                 where upper(replace(r.code, ' ', '')) = afroloc_preauthorizations.code_norm
                   and r.user_id = auth.uid()));

-- ── AUTORIDADE AUTORIZA ─────────────────────────────────────────────────────
create or replace function public.authority_preauthorize_address(
  p_code text, p_note text default null, p_phone_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_norm text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_role text;
  v_rec  uuid;
begin
  select ur.role into v_role from public.user_roles ur
   where ur.user_id = auth.uid()
     and ur.role in ('admin','admin_national','admin_province','admin_municipality')
   limit 1;
  if v_role is null then raise exception 'forbidden: authority role required'; end if;
  if v_norm = '' then raise exception 'code required'; end if;

  select id into v_rec from public.afroloc_records
   where upper(replace(code, ' ', '')) = v_norm limit 1;
  if v_rec is null then return jsonb_build_object('found', false); end if;

  insert into public.afroloc_preauthorizations
    (afroloc_code, authorized_by, authority_role, validation_phone_number_id, note, status)
  values (p_code, auth.uid(), v_role, p_phone_id, p_note, 'authorized')
  on conflict (code_norm) where status = 'authorized' do nothing;

  return jsonb_build_object('found', true, 'code', v_norm, 'status', 'authorized');
end $$;

-- ── CIDADÃO RESGATA ─────────────────────────────────────────────────────────
-- Só resgata (nunca cria confiança): exige que o registo seja do próprio E que
-- exista pré-autorização ativa. Efeito = igual à validação administrativa.
create or replace function public.redeem_afroloc_authorization(p_code text)
 returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_norm text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_rec uuid; v_owner uuid; v_preauth uuid; v_level int;
begin
  if v_norm = '' then return jsonb_build_object('status', 'error', 'reason', 'code_required'); end if;

  select id, user_id into v_rec, v_owner from public.afroloc_records
   where upper(replace(code, ' ', '')) = v_norm limit 1;
  if v_rec is null then return jsonb_build_object('status', 'not_found'); end if;
  if v_owner is distinct from auth.uid() then return jsonb_build_object('status', 'not_yours'); end if;

  select id, granted_level into v_preauth, v_level from public.afroloc_preauthorizations
   where code_norm = v_norm and status = 'authorized' limit 1;
  if v_preauth is null then return jsonb_build_object('status', 'not_authorized'); end if;

  update public.afroloc_records
     set status = 'certified',
         certification_level = greatest(coalesce(certification_level, 0), coalesce(v_level, 4)),
         approved_at = now(),
         ats_breakdown = coalesce(ats_breakdown, '{}'::jsonb) || jsonb_build_object(
           'source', 'preauthorization', 'bootstrap', true, 'certified_at', now()
         ),
         updated_at = now()
   where id = v_rec;

  if not exists (
    select 1 from public.afroloc_validations
     where afroloc_record_id = v_rec and validation_method = 'authority'
  ) then
    insert into public.afroloc_validations
      (afroloc_record_id, validation_method, authority_role, authority_signature, notes, expires_at, verified_at)
    values (v_rec, 'authority', 'preauthorization', auth.uid()::text,
            'Resgate de pré-autorização', now() + interval '1 year', now());
  end if;

  update public.afroloc_preauthorizations
     set status = 'redeemed', redeemed_at = now(), redeemed_by = auth.uid()
   where id = v_preauth;

  return jsonb_build_object('status', 'confirmed', 'code', v_norm, 'level', greatest(4, coalesce(v_level, 4)));
end $$;

-- ── VER ESTADO (sem resgatar) ── para o campo da ficha mostrar a resposta.
create or replace function public.check_afroloc_authorization(p_code text)
 returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_norm text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_rec uuid; v_owner uuid; v_status text; v_preauth uuid;
begin
  if v_norm = '' then return jsonb_build_object('status', 'error'); end if;
  select id, user_id, status into v_rec, v_owner, v_status from public.afroloc_records
   where upper(replace(code, ' ', '')) = v_norm limit 1;
  if v_rec is null then return jsonb_build_object('status', 'not_found'); end if;
  if v_owner is distinct from auth.uid() then return jsonb_build_object('status', 'not_yours'); end if;
  if v_status = 'certified' then return jsonb_build_object('status', 'already_certified'); end if;
  select id into v_preauth from public.afroloc_preauthorizations
   where code_norm = v_norm and status = 'authorized' limit 1;
  if v_preauth is null then return jsonb_build_object('status', 'not_authorized'); end if;
  return jsonb_build_object('status', 'authorized');
end $$;

grant execute on function public.authority_preauthorize_address(text, text, uuid) to authenticated;
grant execute on function public.redeem_afroloc_authorization(text) to authenticated;
grant execute on function public.check_afroloc_authorization(text) to authenticated;

notify pgrst, 'reload schema';
