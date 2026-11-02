-- Synthetic fixtures ONLY; run exclusively on vxeydrzuvhouvjnttvgs.
-- All users, roles, phone evidence, requests, certificates and configuration
-- changes are rolled back. This does not send SMS, authenticate real humans,
-- approve a geographical perimeter or issue a real resident certificate.
begin;
set local statement_timeout = '30s';
do $test$
declare
 owner_id uuid:=gen_random_uuid(); w1 uuid:=gen_random_uuid(); w2 uuid:=gen_random_uuid();
 field_reviewer uuid:=gen_random_uuid(); other_admin uuid:=gen_random_uuid();
 reviewer uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid(); partner_id uuid:=gen_random_uuid();
 record_id uuid:=gen_random_uuid(); request_id uuid; inv1 uuid; inv2 uuid; cert_id uuid; link_id uuid;
 denied boolean; role_name text;
 result jsonb; payload jsonb; review jsonb:='{"inside_boundary_reviewed":true,"evidence_reviewed":true,"note":"SYNTHETIC ROLLBACK TEST: no real perimeter or residence approval."}';
 code text:='AO-QA-G10-'||substr(replace(gen_random_uuid()::text,'-',''),1,8)||'-0001';
begin
 if exists(select 1 from residence_pilot_requests) or exists(select 1 from residence_pilot_people)
 then raise exception 'Refuse non-empty staging pilot'; end if;
 if (select enabled from residence_pilot_settings where id) then raise exception 'Refuse open pilot'; end if;
 insert into auth.users(id,email,raw_user_meta_data)
 select id,'afroloc-audit-'||id||'@example.invalid','{"full_name":"Synthetic rollback fixture"}'::jsonb
 from unnest(array[owner_id,w1,w2,reviewer,stranger,partner_id,field_reviewer,other_admin]) id;
 insert into user_roles(user_id,role) values(reviewer,'admin'),(other_admin,'admin');
 insert into afroloc_records(id,user_id,code,country,updated_at,is_primary_residence)
 values(record_id,owner_id,code,'AO',now(),false);
 execute 'set local role service_role';
 if current_user<>'service_role' then raise exception 'wrong execution role'; end if;
 foreach role_name in array array['anon','authenticated'] loop
  denied:=false;
  begin
   execute format('set local role %I',role_name);
   perform count(*) from residence_pilot_people;
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'private table accessible to %',role_name; end if;
  denied:=false;
  begin
   execute format('set local role %I',role_name);
   perform residence_pilot_action(reviewer,'list');
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'privileged RPC executable by %',role_name; end if;
 end loop;
 result:=residence_pilot_action(owner_id,'create',record_id,'{"consent":true,"address_label":"SYNTHETIC QA RECORD"}');
 if result->>'reason'<>'pilot_closed' then raise exception 'closed gate failed: %',result; end if;
 result:=residence_pilot_action(owner_id,'configure',null,'{"enabled":true,"boundary_reference":"SYNTHETIC-QA-NOT-A-BOUNDARY","boundary_version":"qa-rollback"}');
 if result->>'reason'<>'forbidden' then raise exception 'authority restriction failed'; end if;
 result:=residence_pilot_action(reviewer,'configure',null,'{"enabled":true,"boundary_reference":"SYNTHETIC-QA-NOT-A-BOUNDARY","boundary_version":"qa-rollback"}');
 if result->>'reason'<>'release_not_ready' then raise exception 'missing approvals accepted'; end if;
 denied:=false;
 begin
  update residence_pilot_settings set enabled=true,boundary_reference='SYNTHETIC-QA-NOT-A-BOUNDARY',boundary_version='qa-rollback';
 exception when check_violation then denied:=true;
 end;
 if not denied then raise exception 'direct configuration bypassed approvals'; end if;
 update residence_pilot_operator_slots set assigned_user_id=field_reviewer,nominated_email='synthetic-field@example.invalid',status='enabled' where role_code='boundary_field_reviewer';
 update residence_pilot_operator_slots set assigned_user_id=reviewer,nominated_email='synthetic-authority@example.invalid',status='enabled',can_issue_certificates=true where role_code='residence_authority_reviewer';
 insert into residence_pilot_release_approvals(approval_code,document_reference,approved_by,approved_at,boundary_reference,boundary_version,boundary_artifact_sha256)
 values('boundary','SYNTHETIC ROLLBACK, NO REAL APPROVAL',field_reviewer,now(),'SYNTHETIC-QA-NOT-A-BOUNDARY','qa-rollback',repeat('a',64));
 insert into residence_pilot_release_approvals(approval_code,document_reference,approved_by,approved_at,retention_reference)
 select approval,'SYNTHETIC ROLLBACK, NO REAL APPROVAL',reviewer,now(),'SYNTHETIC ROLLBACK RETENTION'
 from unnest(array['privacy','authentication','sms']) approval;
 result:=residence_pilot_action(reviewer,'configure',null,'{"enabled":true,"boundary_reference":"SYNTHETIC-QA-NOT-A-BOUNDARY","boundary_version":"qa-rollback"}');
 if result->>'ok'<>'true' then raise exception 'fixture configure failed: %',result; end if;
 for result in select jsonb_build_object('id',id,'name','SYNTHETIC QA PERSON','local',case when id=w1 then 'SYNTHETIC-LOCAL-REFERENCE' else null end) from unnest(array[owner_id,w1,w2]) id loop
  payload:=residence_pilot_action(reviewer,'person',(result->>'id')::uuid,jsonb_build_object('adult_verified',true,'full_name',result->>'name','evidence_reference','SYNTHETIC-NO-IDENTITY-DOCUMENT','local_reference',result->>'local'));
  if payload->>'ok'<>'true' then raise exception 'fixture identity failed: %',payload; end if;
 end loop;
 -- Fixture-only phone evidence: not proof of delivered OTP.
 insert into account_verified_phones(user_id,phone) values(owner_id,'+244900100001'),(w1,'+244900100002'),(w2,'+244900100003');
 result:=residence_pilot_action(owner_id,'create',record_id,'{"consent":false,"address_label":"SYNTHETIC QA RECORD"}');
 if result->>'reason'<>'consent_required' then raise exception 'consent gate failed'; end if;
 result:=residence_pilot_action(owner_id,'create',record_id,'{"consent":true,"address_label":"SYNTHETIC QA RECORD"}');
 if result->>'ok'<>'true' then raise exception 'create failed: %',result; end if;
 request_id:=(result->>'id')::uuid;
 result:=residence_pilot_action(owner_id,'invite',request_id,'{"phone":"+244900100001","consent":true}');
 if result->>'reason'<>'witness_unavailable' then raise exception 'self witness accepted'; end if;
 result:=residence_pilot_action(owner_id,'invite',request_id,'{"phone":"+244900100002","consent":true}');
 if result->>'ok'<>'true' then raise exception 'invite 1 failed: %',result; end if;
 inv1:=(result->>'invitation_id')::uuid;
 result:=residence_pilot_action(owner_id,'invite',request_id,'{"phone":"+244900100003","consent":true}');
 if result->>'ok'<>'true' then raise exception 'invite 2 failed: %',result; end if;
 inv2:=(result->>'invitation_id')::uuid;
 result:=residence_pilot_action(owner_id,'invite',request_id,'{"phone":"+244900100002","consent":true}');
 if result->>'reason'<>'try_later' then raise exception 'resend limit failed'; end if;
 perform residence_pilot_action(owner_id,'send_result',inv1,'{"accepted":false}');
 perform residence_pilot_action(owner_id,'send_result',inv2,'{"accepted":false}');
 payload:='{"answer":"confirm","knows_person":true,"knows_residence":true,"same_household":false,"relationship":"SYNTHETIC","known_since":"2020-01-01","consent":true}';
 result:=residence_pilot_action(stranger,'declare',inv1,payload);
 if result->>'ok'='true' then raise exception 'cross-account declaration accepted'; end if;
 result:=residence_pilot_action(w1,'declare',inv1,payload);
 if result->>'ok'<>'true' then raise exception 'declaration 1 failed: %',result; end if;
 result:=residence_pilot_action(w1,'declare',inv1,payload);
 if result->>'reason'<>'already_declared' then raise exception 'immutable declaration failed'; end if;
 result:=residence_pilot_action(w2,'list');
 if jsonb_array_length(result->'requests')<>0 or result->'invitations'->0->>'answer' is not null
 then raise exception 'other witness testimony leaked'; end if;
 result:=residence_pilot_action(w2,'declare',inv2,payload||'{"same_household":true}'::jsonb);
 if result->>'ok'<>'true' then raise exception 'declaration 2 failed: %',result; end if;
 result:=residence_pilot_action(reviewer,'issue',request_id,review);
 if result->>'reason'<>'two_independent_witnesses_required' then raise exception 'household gate failed: %',result; end if;
 -- Test fixture repair only; application declarations cannot be edited.
 update residence_pilot_declarations set same_household=false where invitation_id=inv2;
 result:=residence_pilot_action(owner_id,'issue',request_id,review);
 if result->>'ok'='true' then raise exception 'self issuance accepted'; end if;
 result:=residence_pilot_action(other_admin,'issue',request_id,review);
 if result->>'reason'<>'nominated_authority_required' then raise exception 'unnominated admin issued'; end if;
 result:=residence_pilot_action(reviewer,'issue',request_id,'{}');
 if result->>'reason'<>'review_required' then raise exception 'manual review bypassed'; end if;
 result:=residence_pilot_action(reviewer,'issue',request_id,review);
 if result->>'ok'<>'true' then raise exception 'synthetic issuance failed: %',result; end if;
 cert_id:=(result->>'certificate_id')::uuid;
 if (select residence_relationship from partner_certificates where id=cert_id)<>'resident' then raise exception 'wrong relationship'; end if;
 result:=partner_link_action('begin',p_subject=>partner_id,p_code=>code,p_hash=>repeat('a',64));
 link_id:=(result->>'request_id')::uuid;
 result:=partner_link_action('approve',p_actor=>owner_id,p_id=>link_id,p_code=>code,p_consent=>true);
 if result->>'ok'<>'true' then raise exception 'partner consent failed: %',result; end if;
 result:=partner_link_action('exchange',p_id=>link_id,p_subject=>partner_id,p_hash=>repeat('a',64));
 if result->>'relationship'<>'resident' or result->>'certified'<>'true' then raise exception 'resident evidence failed: %',result; end if;
 -- Each inner subtransaction restores the active synthetic certificate after
 -- proving a different invalidation route.
 begin
  result:=residence_pilot_action(reviewer,'revoke',request_id,'{"note":"SYNTHETIC revocation test"}');
  if result->>'ok'<>'true' then raise exception 'authority revocation failed'; end if;
  result:=partner_link_action('status',p_id=>link_id,p_subject=>partner_id);
  if result->>'ok'='true' then raise exception 'revoked certificate accepted'; end if;
  raise exception using errcode='P0002',message='restore synthetic fixture';
 exception when no_data_found then null;
 end;
 begin
  result:=residence_pilot_action(reviewer,'configure',null,'{"enabled":false,"boundary_reference":"SYNTHETIC-QA-NOT-A-BOUNDARY","boundary_version":"qa-rollback"}');
  if result->>'ok'<>'true' then raise exception 'closing pilot failed'; end if;
  result:=partner_link_action('status',p_id=>link_id,p_subject=>partner_id);
  if result->>'ok'='true' then raise exception 'closed pilot proof accepted'; end if;
  raise exception using errcode='P0002',message='restore synthetic fixture';
 exception when no_data_found then null;
 end;
 begin
  update residence_pilot_release_approvals set revoked_at=now() where approval_code='privacy';
  if (select enabled from residence_pilot_settings where id) then raise exception 'approval loss did not close pilot'; end if;
  if (select revoked_at from partner_certificates where id=cert_id) is null then raise exception 'approval loss did not revoke certificate'; end if;
  result:=partner_link_action('status',p_id=>link_id,p_subject=>partner_id);
  if result->>'ok'='true' then raise exception 'approval loss still produced evidence'; end if;
  result:=residence_pilot_action(w1,'withdraw_declaration',inv1);
  if result->>'ok'<>'true' then raise exception 'closed pilot blocked withdrawal'; end if;
  raise exception using errcode='P0002',message='restore synthetic fixture';
 exception when no_data_found then null;
 end;
 result:=residence_pilot_action(w1,'withdraw_declaration',inv1);
 if result->>'ok'<>'true' then raise exception 'withdrawal failed'; end if;
 result:=partner_link_action('status',p_id=>link_id,p_subject=>partner_id);
 if result->>'ok'='true' then raise exception 'withdrawn proof accepted'; end if;
 if (select revoked_at from partner_certificates where id=cert_id) is null then raise exception 'certificate was not revoked'; end if;
end $test$;
rollback;
select jsonb_build_object('suite','hosted synthetic rollback','result','PASS','sms_sent',false,'persistent_test_data',false,'pilot_enabled',(select enabled from residence_pilot_settings where id),'approvals',(select count(*) from residence_pilot_release_approvals),'assigned_operators',(select count(*) from residence_pilot_operator_slots where assigned_user_id is not null),'people',(select count(*) from residence_pilot_people),'requests',(select count(*) from residence_pilot_requests),'invitations',(select count(*) from residence_pilot_invitations),'certificates',(select count(*) from partner_certificates where residence_relationship='resident')) as verification;
