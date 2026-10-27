-- The service RPC uses row locks; SELECT plus one UPDATE column permits FOR SHARE.
-- No browser role receives these privileges.
grant select on public.afroloc_records to service_role;
grant update(updated_at) on public.afroloc_records to service_role;
grant execute on function public.has_role(uuid, public.app_role) to service_role;

-- Tighten live lifecycle evidence; no certificate issuance or legacy flag import.
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
 if p_action='exchange' then update public.partner_account_links set consumed_at=now() where id=l.id; end if;
 return jsonb_build_object('ok',true,'certified',true,'version',1,'status','active','revoked_at',null,'relationship','owner','issuer','afroloc.ao','audience','yamilook','link_id',l.id,'subject',l.partner_subject,'code',l.code,'evidence_id',c.id,'issued_at',c.issued_at,'expires_at',least(c.expires_at,l.expires_at,(select expires_at from public.account_verified_phones where user_id=l.subject)),'checked_at',now());
end $$;
revoke all on function public.partner_link_action(text,uuid,uuid,uuid,text,text,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.partner_link_action(text,uuid,uuid,uuid,text,text,boolean,timestamptz) to service_role;
