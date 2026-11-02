-- Install only while this pilot is closed. This migration records NO approvals,
-- assigns NO operators and never promotes residence_pilot_boundary_drafts.
do $$ begin
 perform pg_advisory_xact_lock(61742001);
 lock table public.residence_pilot_settings in share row exclusive mode;
 if exists(select 1 from public.residence_pilot_settings where enabled) then
  raise exception 'Close the Lar do Patriota pilot before installing release gates';
 end if;
end $$;

-- Production already has these two inactive slots; staging does not.
create table if not exists public.residence_pilot_operator_slots (
 slot_code text primary key,
 pilot_code text not null default 'LDP-TAL-001' check(pilot_code='LDP-TAL-001'),
 role_code text not null check(role_code in ('boundary_field_reviewer','residence_authority_reviewer')),
 title text not null, assigned_user_id uuid unique references auth.users(id), nominated_email text,
 status text not null default 'unassigned' check(status in ('unassigned','pending_identity','enabled','suspended')),
 can_issue_certificates boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(pilot_code,role_code),
 constraint enabled_requires_identity check(status<>'enabled' or (assigned_user_id is not null and nominated_email is not null))
);
-- An explicit assignment is still required. Nothing in this migration grants it.
alter table public.residence_pilot_operator_slots drop constraint if exists residence_pilot_operator_slots_can_issue_certificates_check;
alter table public.residence_pilot_operator_slots add constraint residence_pilot_operator_slots_can_issue_certificates_check
 check(not can_issue_certificates or (role_code='residence_authority_reviewer' and status='enabled' and assigned_user_id is not null and length(trim(nominated_email))>3));
insert into public.residence_pilot_operator_slots(slot_code,role_code,title)
 values('LDP-OP-01','boundary_field_reviewer','Técnico de verificação territorial'),
       ('LDP-OP-02','residence_authority_reviewer','Revisor de certificação residencial')
 on conflict do nothing;
alter table public.residence_pilot_operator_slots enable row level security;
revoke all on public.residence_pilot_operator_slots from public,anon,authenticated;
grant select,insert,update,delete on public.residence_pilot_operator_slots to service_role;

-- Controlled operational attestations, never client-supplied checkboxes.
-- References identify restricted evidence; do not store identity documents here.
create table public.residence_pilot_release_approvals (
 approval_code text primary key check(approval_code in ('boundary','privacy','authentication','sms')),
 document_reference text not null check(length(trim(document_reference))>=5),
 approved_by uuid not null references auth.users(id), approved_at timestamptz not null,
 revoked_at timestamptz,
 boundary_reference text, boundary_version text, boundary_artifact_sha256 text,
 retention_reference text,
 check(approval_code<>'boundary' or (
  boundary_reference is not null and length(trim(boundary_reference))>=5 and
  boundary_version is not null and length(trim(boundary_version))>0 and
  boundary_artifact_sha256 is not null and boundary_artifact_sha256 ~ '^[0-9a-f]{64}$')),
 check(approval_code<>'privacy' or (retention_reference is not null and length(trim(retention_reference))>=5))
);
alter table public.residence_pilot_release_approvals enable row level security;
revoke all on public.residence_pilot_release_approvals from public,anon,authenticated;
grant select,insert,update,delete on public.residence_pilot_release_approvals to service_role;

create function public.residence_pilot_release_status(p_reference text,p_version text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare missing text[]:='{}'; field_reviewer uuid; authority uuid; code text;
begin
 select assigned_user_id into field_reviewer from public.residence_pilot_operator_slots
  where pilot_code='LDP-TAL-001' and role_code='boundary_field_reviewer' and status='enabled'
   and assigned_user_id is not null and length(trim(nominated_email))>3;
 select assigned_user_id into authority from public.residence_pilot_operator_slots
  where pilot_code='LDP-TAL-001' and role_code='residence_authority_reviewer' and status='enabled'
   and can_issue_certificates and assigned_user_id is not null and length(trim(nominated_email))>3
   and public.has_role(assigned_user_id,'admin') is true;
 if field_reviewer is null then missing:=array_append(missing,'boundary_reviewer_required'); end if;
 if authority is null or authority=field_reviewer then missing:=array_append(missing,'authority_required'); end if;
 if not exists(select 1 from public.residence_pilot_release_approvals
  where approval_code='boundary' and revoked_at is null and approved_at<=now()
   and approved_by=field_reviewer and boundary_reference=p_reference and boundary_version=p_version)
 then missing:=array_append(missing,'approved_boundary_required'); end if;
 foreach code in array array['privacy','authentication','sms'] loop
  if not exists(select 1 from public.residence_pilot_release_approvals
   where approval_code=code and revoked_at is null and approved_at<=now()
    and public.has_role(approved_by,'admin') is true)
  then missing:=array_append(missing,code||'_approval_required'); end if;
 end loop;
 return jsonb_build_object('ready',cardinality(missing)=0,'missing',to_jsonb(missing));
end $$;
revoke all on function public.residence_pilot_release_status(text,text) from public,anon,authenticated;
grant execute on function public.residence_pilot_release_status(text,text) to service_role;

-- The same transaction lock as the workflow serializes changes with issuance.
create function public.residence_pilot_release_lock()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin perform pg_advisory_xact_lock(61742001); return null; end $$;
create function public.residence_pilot_release_changed()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 update public.residence_pilot_settings set enabled=false,updated_at=now();
 update public.partner_certificates set revoked_at=coalesce(revoked_at,now())
  where residence_relationship='resident' and revoked_at is null;
 return null;
end $$;
create trigger residence_release_approvals_lock before insert or update or delete or truncate
 on public.residence_pilot_release_approvals for each statement execute function public.residence_pilot_release_lock();
create trigger residence_release_approvals_changed after insert or update or delete or truncate
 on public.residence_pilot_release_approvals for each statement execute function public.residence_pilot_release_changed();
create trigger residence_operator_slots_lock before insert or update or delete or truncate
 on public.residence_pilot_operator_slots for each statement execute function public.residence_pilot_release_lock();
create trigger residence_operator_slots_changed after insert or update or delete or truncate
 on public.residence_pilot_operator_slots for each statement execute function public.residence_pilot_release_changed();

-- Protect even direct service-side configuration writes, not only the RPC.
create function public.residence_pilot_settings_gate()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(61742001);
 if new.enabled and (public.residence_pilot_release_status(new.boundary_reference,new.boundary_version)->>'ready')::boolean is not true
 then raise exception using errcode='23514',message='residence_pilot_release_not_ready'; end if;
 if tg_op='UPDATE' and (not new.enabled or new.boundary_reference is distinct from old.boundary_reference or new.boundary_version is distinct from old.boundary_version) then
  update public.partner_certificates set revoked_at=coalesce(revoked_at,now())
   where residence_relationship='resident' and revoked_at is null;
 end if;
 return new;
end $$;
create trigger residence_pilot_settings_lock before insert or update
 on public.residence_pilot_settings for each statement execute function public.residence_pilot_release_lock();
create trigger residence_pilot_settings_gate before insert or update
 on public.residence_pilot_settings for each row execute function public.residence_pilot_settings_gate();
revoke all on function public.residence_pilot_release_lock() from public,anon,authenticated;
revoke all on function public.residence_pilot_release_changed() from public,anon,authenticated;
revoke all on function public.residence_pilot_settings_gate() from public,anon,authenticated;
grant execute on function public.residence_pilot_release_lock(),public.residence_pilot_release_changed(),public.residence_pilot_settings_gate() to service_role;

-- Existing RPC contracts retained; only release and nominated-authority guards added.
create or replace function public.residence_pilot_action(p_actor uuid,p_action text,p_id uuid default null,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.residence_pilot_settings; r public.residence_pilot_requests; a public.afroloc_records;
 i public.residence_pilot_invitations; person public.residence_pilot_people; wid uuid; dest text; result jsonb; new_id uuid; cert uuid; is_admin boolean; n integer;
begin
 if p_actor is null then return jsonb_build_object('ok',false,'reason','unauthorized'); end if;
 is_admin:=public.has_role(p_actor,'admin') is true;
 -- One lock gives the small (100 participant) pilot atomic quota, invite, declaration and issuance decisions.
 perform pg_advisory_xact_lock(61742001);
 select * into s from public.residence_pilot_settings where id=true for update;
 -- Recheck current approvals on every positive operation, including role loss.
 -- Withdrawal, revocation, rejection, listing and closure remain available.
 if p_action in ('person','issue') and not exists(select 1 from public.residence_pilot_operator_slots
  where pilot_code='LDP-TAL-001' and role_code='residence_authority_reviewer' and status='enabled'
   and can_issue_certificates and assigned_user_id=p_actor and is_admin)
 then return jsonb_build_object('ok',false,'reason','nominated_authority_required'); end if;
 if (p_action='person' or (s.enabled and p_action in ('create','invite','declare','issue')))
  and (public.residence_pilot_release_status(s.boundary_reference,s.boundary_version)->>'ready')::boolean is not true
 then return jsonb_build_object('ok',false,'reason','release_not_ready'); end if;
 if p_action='configure' then
  if not is_admin then return jsonb_build_object('ok',false,'reason','forbidden'); end if;
  if (p_data->>'enabled')::boolean is true
   and (public.residence_pilot_release_status(p_data->>'boundary_reference',p_data->>'boundary_version')->>'ready')::boolean is not true
  then return jsonb_build_object('ok',false,'reason','release_not_ready'); end if;
  if length(trim(coalesce(p_data->>'boundary_reference','')))<5 or length(trim(coalesce(p_data->>'boundary_version','')))<1 then return jsonb_build_object('ok',false,'reason','boundary_required'); end if;
  if s.boundary_version is distinct from p_data->>'boundary_version' or s.boundary_reference is distinct from p_data->>'boundary_reference' or (p_data->>'enabled')::boolean is not true then
   update public.partner_certificates set revoked_at=coalesce(revoked_at,now()) where id in(select certificate_id from public.residence_pilot_requests);
  end if;
  update public.residence_pilot_settings set enabled=coalesce((p_data->>'enabled')::boolean,false),boundary_reference=p_data->>'boundary_reference',boundary_version=p_data->>'boundary_version',updated_by=p_actor,updated_at=now();
 elsif p_action='person' then
  if not is_admin or p_id is null or p_id=p_actor then return jsonb_build_object('ok',false,'reason','forbidden'); end if;
  if length(trim(coalesce(p_data->>'full_name','')))<3 or length(trim(coalesce(p_data->>'evidence_reference','')))<5 or (p_data->>'adult_verified')::boolean is not true then return jsonb_build_object('ok',false,'reason','identity_required'); end if;
  insert into public.residence_pilot_people(user_id,full_name,evidence_reference,local_reference,reviewed_by) values(p_id,p_data->>'full_name',p_data->>'evidence_reference',nullif(trim(p_data->>'local_reference'),''),p_actor)
   on conflict(user_id) do update set full_name=excluded.full_name,evidence_reference=excluded.evidence_reference,local_reference=excluded.local_reference,reviewed_by=p_actor,reviewed_at=now(),expires_at=now()+interval '90 days',revoked_at=null;
 elsif p_action='revoke_person' then
  if not is_admin then return jsonb_build_object('ok',false,'reason','forbidden'); end if;
  update public.residence_pilot_people set revoked_at=now() where user_id=p_id;
  update public.partner_certificates set revoked_at=coalesce(revoked_at,now()) where id in(
   select certificate_id from public.residence_pilot_requests q where q.subject=p_id or exists(select 1 from public.residence_pilot_invitations v where v.request_id=q.id and v.witness=p_id));
 elsif p_action='list' then
  return jsonb_build_object('ok',true,'admin',is_admin,'settings',to_jsonb(s),'release',public.residence_pilot_release_status(s.boundary_reference,s.boundary_version),
   'addresses',(select coalesce(jsonb_agg(x),'[]') from (select id,code from public.afroloc_records where user_id=p_actor and country in ('AO','Angola') order by updated_at desc limit 100) x),
   'requests',(select coalesce(jsonb_agg(x),'[]') from (select q.*,pc.expires_at certificate_expires_at,pc.revoked_at certificate_revoked_at,pp.full_name,
    (select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'witness',v.witness,'name',wp.full_name,'send_state',v.send_state,'expires_at',v.expires_at,'answer',d.answer,'withdrawn_at',d.withdrawn_at,'knows_person',d.knows_person,'knows_residence',d.knows_residence,'same_household',d.same_household,'relationship',d.relationship,'known_since',d.known_since,'declared_at',d.declared_at,'declaration_version',d.declaration_version,'identity_reference',case when is_admin then coalesce(d.identity_snapshot->>'evidence_reference',wp.evidence_reference) end,'local_reference',case when is_admin then coalesce(d.identity_snapshot->>'local_reference',wp.local_reference) end)),'[]') from public.residence_pilot_invitations v left join public.residence_pilot_declarations d on d.invitation_id=v.id left join public.residence_pilot_people wp on wp.user_id=v.witness where v.request_id=q.id) invitations
    from public.residence_pilot_requests q left join public.partner_certificates pc on pc.id=q.certificate_id left join public.residence_pilot_people pp on pp.user_id=q.subject where q.subject=p_actor or is_admin order by q.created_at desc limit 100) x),
   'invitations',(select coalesce(jsonb_agg(x),'[]') from (select v.id,q.id request_id,q.code,q.address_label,q.record_updated_at,q.boundary_version,pp.full_name,v.expires_at,d.answer,d.withdrawn_at
     from public.residence_pilot_invitations v join public.residence_pilot_requests q on q.id=v.request_id join public.residence_pilot_people pp on pp.user_id=q.subject left join public.residence_pilot_declarations d on d.invitation_id=v.id where v.witness=p_actor order by v.created_at desc limit 100) x));
 elsif p_action='create' then
  if not s.enabled then return jsonb_build_object('ok',false,'reason','pilot_closed'); end if;
  if (p_data->>'consent')::boolean is not true then return jsonb_build_object('ok',false,'reason','consent_required'); end if;
  if not exists(select 1 from public.residence_pilot_people where user_id=p_actor and revoked_at is null and expires_at>now()) then return jsonb_build_object('ok',false,'reason','identity_required'); end if;
  if (select count(distinct subject) from public.residence_pilot_requests)>=100 and not exists(select 1 from public.residence_pilot_requests where subject=p_actor) then return jsonb_build_object('ok',false,'reason','pilot_full'); end if;
  if exists(select 1 from public.residence_pilot_requests where subject=p_actor and (status='pending' or created_at>now()-interval '1 day')) then return jsonb_build_object('ok',false,'reason','existing_request'); end if;
  select * into a from public.afroloc_records where id=p_id and user_id=p_actor for share;
  if not found or a.updated_at is null or a.country not in ('AO','Angola') then return jsonb_build_object('ok',false,'reason','address_required'); end if;
  if length(trim(coalesce(p_data->>'address_label','')))<5 then return jsonb_build_object('ok',false,'reason','address_required'); end if;
  insert into public.residence_pilot_requests(subject,record_id,code,record_updated_at,address_label,boundary_version) values(p_actor,a.id,a.code,a.updated_at,p_data->>'address_label',s.boundary_version) returning id into new_id;
  insert into public.residence_pilot_events(actor,request_id,event) values(p_actor,new_id,'created');
  return jsonb_build_object('ok',true,'id',new_id);
 elsif p_action in ('declare','withdraw_declaration','send_result') then
  select * into i from public.residence_pilot_invitations where id=p_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','unavailable'); end if;
  select * into r from public.residence_pilot_requests where id=i.request_id for update;
 else
  select * into r from public.residence_pilot_requests where id=p_id for update;
 end if;
 if p_action in ('configure','person','revoke_person') then
  insert into public.residence_pilot_events(actor,event) values(p_actor,p_action);return jsonb_build_object('ok',true);
 end if;
 if r.id is null then return jsonb_build_object('ok',false,'reason','unavailable'); end if;
 if p_action in ('withdraw','reject','revoke') then
  if (p_action='withdraw' and r.subject<>p_actor) or (p_action<>'withdraw' and not is_admin) then return jsonb_build_object('ok',false,'reason','forbidden'); end if;
  update public.partner_certificates set revoked_at=coalesce(revoked_at,now()) where id=r.certificate_id;
  update public.residence_pilot_requests set status=case when p_action='reject' then 'rejected' else 'withdrawn' end,review_note=p_data->>'note',reviewed_by=p_actor,reviewed_at=now() where id=r.id;
 elsif p_action='withdraw_declaration' then
  if i.witness<>p_actor then return jsonb_build_object('ok',false,'reason','forbidden'); end if;
  update public.residence_pilot_declarations set withdrawn_at=coalesce(withdrawn_at,now()) where invitation_id=i.id;
  update public.partner_certificates set revoked_at=coalesce(revoked_at,now()) where id=r.certificate_id;
 elsif p_action='send_result' then
  if r.subject<>p_actor or i.send_state<>'sending' then return jsonb_build_object('ok',false,'reason','forbidden'); end if;
  update public.residence_pilot_invitations set send_state=case when (p_data->>'accepted')::boolean then 'accepted' else 'failed' end,delivery_reference=p_data->>'reference' where id=i.id;
 else
  if not s.enabled or r.status<>'pending' or r.expires_at<=now() or r.boundary_version is distinct from s.boundary_version then return jsonb_build_object('ok',false,'reason','request_inactive'); end if;
  select * into a from public.afroloc_records where id=r.record_id for share;
  if a.user_id is distinct from r.subject or a.code is distinct from r.code or a.updated_at is distinct from r.record_updated_at then return jsonb_build_object('ok',false,'reason','address_changed'); end if;
  if p_action='invite' then
   if r.subject<>p_actor or (p_data->>'consent')::boolean is not true then return jsonb_build_object('ok',false,'reason','forbidden'); end if;
   select v.user_id,v.phone into wid,dest from public.account_verified_phones v join public.residence_pilot_people pp on pp.user_id=v.user_id where v.phone=p_data->>'phone' and v.phone ~ '^\+244[0-9]{9}$' and v.revoked_at is null and v.expires_at>now() and pp.revoked_at is null and pp.expires_at>now() and v.user_id<>p_actor;
   if wid is null then return jsonb_build_object('ok',false,'reason','witness_unavailable'); end if;
   select * into i from public.residence_pilot_invitations where request_id=r.id and witness=wid for update;
   if i.id is null then
    if (select count(*) from public.residence_pilot_invitations where request_id=r.id)>=2 then return jsonb_build_object('ok',false,'reason','two_witness_limit'); end if;
    insert into public.residence_pilot_invitations(request_id,witness,phone) values(r.id,wid,dest) returning * into i;
   end if;
   if i.expires_at<=now() or i.send_count>=3 or i.last_send_at>now()-interval '5 minutes' or exists(select 1 from public.residence_pilot_declarations where invitation_id=i.id) then return jsonb_build_object('ok',false,'reason','try_later'); end if;
   if (select coalesce(sum(send_count),0) from public.residence_pilot_invitations where witness=wid and created_at>now()-interval '1 day')>=6 then return jsonb_build_object('ok',false,'reason','try_later'); end if;
   update public.residence_pilot_invitations set send_state='sending',send_count=send_count+1,last_send_at=now() where id=i.id;
   insert into public.residence_pilot_events(actor,request_id,event) values(p_actor,r.id,'sms_reserved');
   return jsonb_build_object('ok',true,'invitation_id',i.id,'phone',dest);
  elsif p_action='declare' then
   if i.witness<>p_actor or i.expires_at<=now() or (p_data->>'consent')::boolean is not true then return jsonb_build_object('ok',false,'reason','unavailable'); end if;
   if not exists(select 1 from public.account_verified_phones where user_id=p_actor and phone=i.phone and revoked_at is null and expires_at>now()) or not exists(select 1 from public.residence_pilot_people where user_id=p_actor and revoked_at is null and expires_at>now()) then return jsonb_build_object('ok',false,'reason','identity_required'); end if;
   if p_data->>'answer' not in ('confirm','deny','unknown') or p_data->>'answer' is null or length(trim(coalesce(p_data->>'relationship','')))<3 or (p_data->>'known_since')::date>current_date or p_data->>'known_since' is null or p_data->>'same_household' is null then return jsonb_build_object('ok',false,'reason','declaration_required'); end if;
   if p_data->>'answer'='confirm' and ((p_data->>'knows_person')::boolean is not true or (p_data->>'knows_residence')::boolean is not true) then return jsonb_build_object('ok',false,'reason','residence_required'); end if;
   if exists(select 1 from public.residence_pilot_declarations where invitation_id=i.id) then return jsonb_build_object('ok',false,'reason','already_declared'); end if;
   select count(*) into n from public.residence_pilot_declarations d join public.residence_pilot_invitations v on v.id=d.invitation_id where v.witness=p_actor and d.answer='confirm' and d.declared_at>now()-interval '30 days';
   if n>=5 then return jsonb_build_object('ok',false,'reason','witness_limit'); end if;
   insert into public.residence_pilot_declarations(invitation_id,answer,knows_person,knows_residence,same_household,relationship,known_since,identity_snapshot) values(i.id,p_data->>'answer',coalesce((p_data->>'knows_person')::boolean,false),coalesce((p_data->>'knows_residence')::boolean,false),(p_data->>'same_household')::boolean,p_data->>'relationship',(p_data->>'known_since')::date,(select to_jsonb(pp) from public.residence_pilot_people pp where pp.user_id=p_actor));
  elsif p_action='issue' then
   if not is_admin or p_actor=r.subject or exists(select 1 from public.residence_pilot_invitations where request_id=r.id and witness=p_actor) then return jsonb_build_object('ok',false,'reason','forbidden'); end if;
   if (p_data->>'inside_boundary_reviewed')::boolean is not true or (p_data->>'evidence_reviewed')::boolean is not true or length(trim(coalesce(p_data->>'note','')))<10 then return jsonb_build_object('ok',false,'reason','review_required'); end if;
   if not exists(select 1 from public.residence_pilot_people where user_id=r.subject and revoked_at is null and expires_at>now()) then return jsonb_build_object('ok',false,'reason','identity_required'); end if;
   select count(*) into n from public.residence_pilot_invitations v join public.residence_pilot_declarations d on d.invitation_id=v.id join public.residence_pilot_people pp on pp.user_id=v.witness join public.account_verified_phones ph on ph.user_id=v.witness
    where v.request_id=r.id and d.answer='confirm' and d.withdrawn_at is null and d.knows_person and d.knows_residence and not d.same_household and pp.revoked_at is null and pp.expires_at>now() and (d.identity_snapshot->>'reviewed_at')::timestamptz=pp.reviewed_at and ph.phone=v.phone and ph.revoked_at is null and ph.expires_at>now();
   if n<>2 or not exists(select 1 from public.residence_pilot_invitations v join public.residence_pilot_people pp on pp.user_id=v.witness where v.request_id=r.id and pp.local_reference is not null and pp.revoked_at is null and pp.expires_at>now()) then return jsonb_build_object('ok',false,'reason','two_independent_witnesses_required'); end if;
   if exists(select 1 from public.residence_pilot_invitations v join public.residence_pilot_requests q on q.subject=v.witness join public.residence_pilot_invitations back on back.request_id=q.id join public.residence_pilot_declarations d on d.invitation_id=back.id where v.request_id=r.id and back.witness=r.subject and d.answer='confirm' and d.withdrawn_at is null) then return jsonb_build_object('ok',false,'reason','reciprocal_review_required'); end if;
   -- Reuse the authority issuer and existing partner status/revocation mechanism.
   result:=public.partner_link_action('issue',p_actor,r.record_id,null,null,null,true,least(now()+interval '90 days',(select min(expires_at) from public.residence_pilot_people where user_id=r.subject or user_id in(select witness from public.residence_pilot_invitations where request_id=r.id))));
   if (result->>'ok')::boolean is not true then return result; end if;
   cert:=(result->>'certificate_id')::uuid;
   update public.partner_certificates set residence_relationship='resident' where id=cert;
   update public.residence_pilot_requests set status='issued',certificate_id=cert,reviewed_by=p_actor,reviewed_at=now(),review_note=p_data->>'note' where id=r.id;
  else return jsonb_build_object('ok',false,'reason','invalid_request');
  end if;
 end if;
 insert into public.residence_pilot_events(actor,request_id,event) values(p_actor,r.id,p_action);
 return jsonb_build_object('ok',true,'certificate_id',cert);
end $$;
revoke all on function public.residence_pilot_action(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.residence_pilot_action(uuid,text,uuid,jsonb) to service_role;

create or replace function public.partner_link_action(p_action text,p_actor uuid default null,p_id uuid default null,p_subject uuid default null,p_code text default null,p_hash text default null,p_consent boolean default false,p_expiry timestamptz default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare l public.partner_account_links; c public.partner_certificates; r public.afroloc_records; new_id uuid;
begin
 if p_action='list_user' then
  if p_actor is null then return jsonb_build_object('ok',false,'reason','unauthorized'); end if;
  return jsonb_build_object('ok',true,'links',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select id,code,expires_at,revoked_at from public.partner_account_links where subject=p_actor order by created_at desc limit 20) x));
 elsif p_action='issue' then
  if p_actor is null or public.has_role(p_actor,'admin') is not true then return jsonb_build_object('ok',false,'reason','forbidden'); end if;
  select * into r from public.afroloc_records where id=p_id for share;
  if not found or r.user_id is null or r.user_id=p_actor or p_expiry is null or p_expiry<=now() or p_expiry>now()+interval '90 days' then
   return jsonb_build_object('ok',false,'reason','invalid_evidence');
  end if;
  -- An authority must explicitly review the record; no inference from its status.
  if p_consent is distinct from true then return jsonb_build_object('ok',false,'reason','review_required'); end if;
  insert into public.partner_certificates(record_id,subject,code,issued_by,record_updated_at,expires_at)
   values(r.id,r.user_id,r.code,p_actor,r.updated_at,p_expiry) returning id into new_id;
  insert into public.account_security_events(user_id,event) values(p_actor,'partner_certificate_issued');
  return jsonb_build_object('ok',true,'certificate_id',new_id);
 elsif p_action='revoke_certificate' then
  if p_actor is null or public.has_role(p_actor,'admin') is not true then return jsonb_build_object('ok',false,'reason','forbidden'); end if;
  update public.partner_certificates set revoked_at=coalesce(revoked_at,now()) where id=p_id;
  if not found then return jsonb_build_object('ok',false,'reason','unavailable'); end if;
  insert into public.account_security_events(user_id,event) values(p_actor,'partner_certificate_revoked');
  return jsonb_build_object('ok',true);
 elsif p_action='begin' then
  if p_subject is null or p_code is null or length(p_code)=0 or length(p_code)>200 or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
   return jsonb_build_object('ok',false,'reason','invalid_request');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_subject::text,2));
  if (select count(*) from public.partner_account_links where partner_subject=p_subject and created_at>now()-interval '1 hour')>=5 then
   return jsonb_build_object('ok',false,'reason','try_later');
  end if;
  insert into public.partner_account_links(partner,partner_subject,code,verifier_hash) values('yamilook',p_subject,p_code,p_hash) returning id into new_id;
  return jsonb_build_object('ok',true,'request_id',new_id);
 end if;
 select * into l from public.partner_account_links where id=p_id for update;
 if not found then return jsonb_build_object('ok',false,'reason','unavailable'); end if;
 if p_action in ('inspect','approve') then
  if p_actor is null or l.revoked_at is not null or l.consumed_at is not null or l.request_expires_at<=now() then return jsonb_build_object('ok',false,'reason','unavailable'); end if;
  select pc.* into c from public.partner_certificates pc join public.afroloc_records ar on ar.id=pc.record_id
   where pc.subject=p_actor and pc.code=l.code and pc.revoked_at is null and pc.issued_at<=now() and pc.expires_at>now()
   and public.has_role(pc.issued_by,'admin') is true and pc.issued_by<>pc.subject
   and ar.user_id=pc.subject and ar.code=pc.code and ar.updated_at=pc.record_updated_at order by pc.issued_at desc limit 1 for share of pc,ar;
  if not found then return jsonb_build_object('ok',false,'reason','unavailable'); end if;
  if p_action='inspect' then return jsonb_build_object('ok',true,'code',l.code,'recipient','Yamilook / KOSOLOLA','account_reference',right(l.partner_subject::text,8),'expires_at',l.request_expires_at); end if;
  if p_consent is distinct from true or p_code is distinct from l.code or l.consent_at is not null then return jsonb_build_object('ok',false,'reason','consent_required'); end if;
  if not exists(select 1 from public.account_verified_phones where user_id=p_actor and revoked_at is null and expires_at>now()) then return jsonb_build_object('ok',false,'reason','phone_required'); end if;
  update public.partner_account_links set subject=p_actor,certificate_id=c.id,consent_at=now(),expires_at=least(c.expires_at,now()+interval '90 days') where id=l.id;
  insert into public.account_security_events(user_id,event) values(p_actor,'partner_link_approved');
  return jsonb_build_object('ok',true);
 elsif p_action='revoke_user' then
  if p_actor is null or l.subject is distinct from p_actor then return jsonb_build_object('ok',false,'reason','unavailable'); end if;
 elsif p_action in ('exchange','status','revoke_partner') then
  if p_subject is null or l.partner_subject is distinct from p_subject then return jsonb_build_object('ok',false,'reason','unavailable'); end if;
 else return jsonb_build_object('ok',false,'reason','invalid_request');
 end if;
 if p_action in ('revoke_user','revoke_partner') then
  update public.partner_account_links set revoked_at=now() where id=l.id;
  insert into public.account_security_events(user_id,event) values(coalesce(p_actor,p_subject),'partner_link_revoked');
  return jsonb_build_object('ok',true);
 end if;
 if l.revoked_at is not null or l.consent_at is null or l.consent_at>now() or l.expires_at is null or l.expires_at<=now() then return jsonb_build_object('ok',false,'reason','unavailable'); end if;
 if p_action='exchange' and (l.consumed_at is not null or l.request_expires_at<=now() or p_hash is null or p_hash<>l.verifier_hash) then return jsonb_build_object('ok',false,'reason','invalid_grant'); end if;
 if p_action='status' and l.consumed_at is null then return jsonb_build_object('ok',false,'reason','unavailable'); end if;
 select * into c from public.partner_certificates where id=l.certificate_id for share;
 select * into r from public.afroloc_records where id=c.record_id for share;
 if c.id is null or r.id is null or c.issued_at>now() or c.issued_by=c.subject
  or c.revoked_at is not null or c.expires_at<=now() or c.subject is distinct from l.subject or c.code is distinct from l.code
  or r.user_id is distinct from c.subject or r.code is distinct from c.code or r.updated_at is distinct from c.record_updated_at
  or public.has_role(c.issued_by,'admin') is not true
  or not exists(select 1 from public.account_verified_phones where user_id=l.subject and revoked_at is null and expires_at>now()) then
  return jsonb_build_object('ok',false,'reason','unavailable');
 end if;
 if c.residence_relationship='resident' and not exists(
  select 1 from public.residence_pilot_settings ps where ps.enabled
   and (public.residence_pilot_release_status(ps.boundary_reference,ps.boundary_version)->>'ready')::boolean is true)
 then return jsonb_build_object('ok',false,'reason','unavailable'); end if;
 if c.residence_relationship='resident' and not exists(
  select 1 from public.residence_pilot_requests q join public.residence_pilot_settings ps on ps.id=true
  join public.residence_pilot_people subject_person on subject_person.user_id=q.subject
  where q.certificate_id=c.id and q.status='issued' and ps.enabled and q.boundary_version=ps.boundary_version
  and subject_person.revoked_at is null and subject_person.expires_at>now()
  and (select count(*) from public.residence_pilot_invitations v join public.residence_pilot_declarations d on d.invitation_id=v.id
    join public.residence_pilot_people pp on pp.user_id=v.witness join public.account_verified_phones ph on ph.user_id=v.witness
    where v.request_id=q.id and d.answer='confirm' and d.withdrawn_at is null and pp.revoked_at is null and pp.expires_at>now()
    and (d.identity_snapshot->>'reviewed_at')::timestamptz=pp.reviewed_at and ph.revoked_at is null and ph.expires_at>now() and ph.phone=v.phone)=2
 ) then return jsonb_build_object('ok',false,'reason','unavailable'); end if;
 if p_action='exchange' then update public.partner_account_links set consumed_at=now() where id=l.id; end if;
 return jsonb_build_object('ok',true,'certified',true,'version',1,'status','active','revoked_at',null,'relationship',c.residence_relationship,'issuer','afroloc.ao','audience','yamilook','link_id',l.id,'subject',l.partner_subject,'code',l.code,'evidence_id',c.id,'issued_at',c.issued_at,'expires_at',least(c.expires_at,l.expires_at,(select expires_at from public.account_verified_phones where user_id=l.subject)),'checked_at',now());
end $$;
revoke all on function public.partner_link_action(text,uuid,uuid,uuid,text,text,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.partner_link_action(text,uuid,uuid,uuid,text,text,boolean,timestamptz) to service_role;
