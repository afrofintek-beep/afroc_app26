
-- Independent phone possession evidence. Never modifies auth.users or profiles.
create table public.account_phone_challenges (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'), digest text not null,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '5 minutes',
 attempts int not null default 0, delivered boolean not null default false, consumed_at timestamptz
);
create index on public.account_phone_challenges(user_id,created_at);
create index on public.account_phone_challenges(phone,created_at);
create table public.account_verified_phones (
 user_id uuid primary key references auth.users(id) on delete cascade, phone text not null unique,
 verified_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '180 days',
 revoked_at timestamptz
);
create table public.account_security_events (
 id bigint generated always as identity primary key, user_id uuid not null,
 event text not null, created_at timestamptz not null default now()
);
alter table public.account_phone_challenges enable row level security;
alter table public.account_verified_phones enable row level security;
alter table public.account_security_events enable row level security;
revoke all on public.account_phone_challenges,public.account_verified_phones,public.account_security_events from public,anon,authenticated;
grant all on public.account_phone_challenges,public.account_verified_phones,public.account_security_events to service_role;
revoke all on sequence public.account_security_events_id_seq from public,anon,authenticated;
grant usage on sequence public.account_security_events_id_seq to service_role;

create function public.account_phone_action(p_actor uuid,p_action text,p_id uuid default null,p_phone text default null,p_digest text default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare c public.account_phone_challenges; v public.account_verified_phones;
begin
 if p_actor is null then return jsonb_build_object('ok',false,'reason','unauthorized'); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,0));
 if p_action='status' then
  select * into v from public.account_verified_phones where user_id=p_actor;
  return jsonb_build_object('ok',true,'verified',v.user_id is not null and v.revoked_at is null and v.expires_at>now(),'expires_at',v.expires_at);
 elsif p_action='revoke' then
  update public.account_verified_phones set revoked_at=now() where user_id=p_actor;
  update public.account_phone_challenges set consumed_at=now() where user_id=p_actor and consumed_at is null;
  insert into public.account_security_events(user_id,event) values(p_actor,'phone_revoked');
  return jsonb_build_object('ok',true);
 elsif p_action='begin' then
  if p_id is null or p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' or p_digest is null or length(p_digest)<>64 then
   return jsonb_build_object('ok',false,'reason','invalid_request');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_phone,1));
  if exists(select 1 from public.account_phone_challenges where user_id=p_actor and created_at>now()-interval '60 seconds')
   or (select count(*) from public.account_phone_challenges where user_id=p_actor and created_at>now()-interval '1 hour')>=5
   or (select count(*) from public.account_phone_challenges where phone=p_phone and created_at>now()-interval '1 hour')>=5 then
    return jsonb_build_object('ok',false,'reason','try_later');
  end if;
  update public.account_phone_challenges set consumed_at=now() where user_id=p_actor and consumed_at is null;
  insert into public.account_phone_challenges(id,user_id,phone,digest) values(p_id,p_actor,p_phone,p_digest);
  insert into public.account_security_events(user_id,event) values(p_actor,'phone_challenge_started');
  return jsonb_build_object('ok',true,'challenge_id',p_id);
 end if;
 select * into c from public.account_phone_challenges where id=p_id and user_id=p_actor for update;
 if not found or c.consumed_at is not null or c.expires_at<=now() then return jsonb_build_object('ok',false,'reason','invalid_challenge'); end if;
 if p_action='delivered' then
  update public.account_phone_challenges set delivered=true where id=c.id;
  return jsonb_build_object('ok',true);
 elsif p_action='cancel' then
  update public.account_phone_challenges set consumed_at=now() where id=c.id;
  return jsonb_build_object('ok',true);
 elsif p_action='verify' then
  if not c.delivered or c.attempts>=5 then return jsonb_build_object('ok',false,'reason','invalid_challenge'); end if;
  update public.account_phone_challenges set attempts=attempts+1 where id=c.id;
  if p_digest is null or c.digest<>p_digest then return jsonb_build_object('ok',false,'reason','invalid_challenge'); end if;
  perform pg_advisory_xact_lock(hashtextextended(c.phone,1));
  -- No takeover/merge even for a recycled number: recovery requires separate review.
  if exists(select 1 from public.account_verified_phones where phone=c.phone and user_id<>p_actor) then
   update public.account_phone_challenges set consumed_at=now() where id=c.id;
   return jsonb_build_object('ok',false,'reason','verification_failed');
  end if;
  update public.account_phone_challenges set consumed_at=now() where id=c.id;
  insert into public.account_verified_phones(user_id,phone) values(p_actor,c.phone)
   on conflict(user_id) do update set phone=excluded.phone,verified_at=now(),expires_at=now()+interval '180 days',revoked_at=null;
  insert into public.account_security_events(user_id,event) values(p_actor,'phone_verified');
  return jsonb_build_object('ok',true,'verified',true);
 end if;
 return jsonb_build_object('ok',false,'reason','invalid_request');
end $$;
revoke all on function public.account_phone_action(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.account_phone_action(uuid,text,uuid,text,text) to service_role;

-- New authority evidence is explicit; NEVER import legacy certified flags.
create table public.partner_certificates (
 id uuid primary key default gen_random_uuid(), record_id uuid not null references public.afroloc_records(id),
 subject uuid not null references auth.users(id), code text not null, issued_by uuid not null references auth.users(id),
 record_updated_at timestamptz not null, issued_at timestamptz not null default now(), expires_at timestamptz not null,
 revoked_at timestamptz, check(expires_at>issued_at)
);
create table public.partner_account_links (
 id uuid primary key default gen_random_uuid(), partner text not null check(partner='yamilook'),
 partner_subject uuid not null, code text not null, verifier_hash text not null,
 created_at timestamptz not null default now(), request_expires_at timestamptz not null default now()+interval '10 minutes',
 subject uuid references auth.users(id), certificate_id uuid references public.partner_certificates(id),
 consent_at timestamptz, consumed_at timestamptz, expires_at timestamptz, revoked_at timestamptz
);
create index on public.partner_account_links(partner_subject,created_at);
alter table public.partner_certificates enable row level security;
alter table public.partner_account_links enable row level security;
revoke all on public.partner_certificates,public.partner_account_links from public,anon,authenticated;
grant all on public.partner_certificates,public.partner_account_links to service_role;

create function public.partner_link_action(p_action text,p_actor uuid default null,p_id uuid default null,p_subject uuid default null,p_code text default null,p_hash text default null,p_consent boolean default false,p_expiry timestamptz default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare l public.partner_account_links; c public.partner_certificates; r public.afroloc_records; new_id uuid;
begin
 if p_action='list_user' then
  if p_actor is null then return jsonb_build_object('ok',false,'reason','unauthorized'); end if;
  return jsonb_build_object('ok',true,'links',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select id,code,expires_at,revoked_at from public.partner_account_links where subject=p_actor order by created_at desc limit 20) x));
 elsif p_action='issue' then
  if p_actor is null or not public.has_role(p_actor,'admin') then return jsonb_build_object('ok',false,'reason','forbidden'); end if;
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
  if p_actor is null or not public.has_role(p_actor,'admin') then return jsonb_build_object('ok',false,'reason','forbidden'); end if;
  update public.partner_certificates set revoked_at=now() where id=p_id;
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
   where pc.subject=p_actor and pc.code=l.code and pc.revoked_at is null and pc.expires_at>now()
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
 if l.revoked_at is not null or l.consent_at is null or l.expires_at<=now() then return jsonb_build_object('ok',false,'reason','unavailable'); end if;
 if p_action='exchange' and (l.consumed_at is not null or l.request_expires_at<=now() or p_hash is null or p_hash<>l.verifier_hash) then return jsonb_build_object('ok',false,'reason','invalid_grant'); end if;
 if p_action='status' and l.consumed_at is null then return jsonb_build_object('ok',false,'reason','unavailable'); end if;
 select * into c from public.partner_certificates where id=l.certificate_id for share;
 select * into r from public.afroloc_records where id=c.record_id for share;
 if c.revoked_at is not null or c.expires_at<=now() or c.subject is distinct from l.subject or c.code is distinct from l.code
  or r.user_id is distinct from c.subject or r.code is distinct from c.code or r.updated_at is distinct from c.record_updated_at
  or not public.has_role(c.issued_by,'admin')
  or not exists(select 1 from public.account_verified_phones where user_id=l.subject and revoked_at is null and expires_at>now()) then
  return jsonb_build_object('ok',false,'reason','unavailable');
 end if;
 if p_action='exchange' then update public.partner_account_links set consumed_at=now() where id=l.id; end if;
 return jsonb_build_object('ok',true,'certified',true,'issuer','afroloc.ao','audience','yamilook','link_id',l.id,'subject',l.partner_subject,'code',l.code,'evidence_id',c.id,'issued_at',c.issued_at,'expires_at',least(c.expires_at,l.expires_at),'checked_at',now());
end $$;
revoke all on function public.partner_link_action(text,uuid,uuid,uuid,text,text,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.partner_link_action(text,uuid,uuid,uuid,text,text,boolean,timestamptz) to service_role;
