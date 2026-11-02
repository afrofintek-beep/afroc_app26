import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const ids=Array.from({length:8},(_,n)=>`${n+1}1111111-1111-4111-8111-111111111111`);
const [owner,w1,w2,authority,stranger,record,partner,otherRecord]=ids;
const fieldReviewer='91111111-1111-4111-8111-111111111111',otherAdmin='a1111111-1111-4111-8111-111111111111';
ids.push(fieldReviewer,otherAdmin);
const config={enabled:true,boundary_reference:'MAP-APPROVED-1',boundary_version:'v1'};
const call=async(actor,action,id=null,data={})=>(await db.query('select residence_pilot_action($1,$2,$3,$4) result',[actor,action,id,JSON.stringify(data)])).rows[0].result;
const link=async(action,args={})=>(await db.query('select partner_link_action($1,$2,$3,$4,$5,$6,$7,$8) result',[action,args.actor??null,args.id??null,args.subject??null,args.code??null,args.hash??null,args.consent??false,args.expiry??null])).rows[0].result;
let request,inv1,inv2,cert,grant;
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);grant usage on schema public to anon,authenticated,service_role;create type public.app_role as enum ('admin');create table test_admins(id uuid primary key);insert into test_admins values('${authority}'),('${otherAdmin}');grant select on test_admins to service_role;create function public.has_role(u uuid,r public.app_role) returns boolean language sql as $$select exists(select 1 from test_admins where id=u) and r='admin'$$;create table afroloc_records(id uuid primary key,user_id uuid,code text,country text default 'AO',updated_at timestamptz not null default now());`);
 for(const id of ids)await db.query('insert into auth.users values($1)',[id]);
 await db.query('insert into afroloc_records(id,user_id,code) values($1,$2,$3),($4,$5,$6)',[record,owner,'TEST-LAR',otherRecord,stranger,'OTHER']);
 const dir=new URL('../../supabase/migrations/',import.meta.url);
 for(const suffix of ['authorized_account_link.sql','partner_certificate_lifecycle.sql','lar_patriota_workflow.sql','lar_patriota_release_gates.sql'])for(const f of readdirSync(dir).filter(x=>x.endsWith(suffix)).sort())await db.exec(readFileSync(new URL(f,dir),'utf8'));
});
after(()=>db.close());
test('pilot starts closed, public roles cannot read or mutate data or spoof an actor',async()=>{
 assert.equal((await call(owner,'create',record,{consent:true,address_label:'Rua teste, casa 1'})).reason,'pilot_closed');
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  for(const table of ['settings','people','requests','invitations','declarations','events','operator_slots','release_approvals'])await assert.rejects(db.query(`select * from residence_pilot_${table}`),/permission denied/);
  await assert.rejects(call(authority,'configure',null,{}),/permission denied/);await db.exec('reset role');
 }
});
test('opening requires recorded approvals, exact perimeter and two nominated operators',async()=>{
 assert.equal((await call(authority,'configure',null,config)).reason,'release_not_ready');
 await assert.rejects(db.exec(`update residence_pilot_settings set enabled=true,boundary_reference='MAP-APPROVED-1',boundary_version='v1'`),/residence_pilot_release_not_ready/);
 const status=async()=>(await db.query('select residence_pilot_release_status($1,$2) result',[config.boundary_reference,config.boundary_version])).rows[0].result;
 assert.deepEqual((await status()).missing,['boundary_reviewer_required','authority_required','approved_boundary_required','privacy_approval_required','authentication_approval_required','sms_approval_required']);
 await db.query(`update residence_pilot_operator_slots set assigned_user_id=$1,nominated_email='synthetic-field@example.invalid',status='enabled' where role_code='boundary_field_reviewer'`,[fieldReviewer]);
 await db.query(`update residence_pilot_operator_slots set assigned_user_id=$1,nominated_email='synthetic-authority@example.invalid',status='enabled',can_issue_certificates=true where role_code='residence_authority_reviewer'`,[authority]);
 await assert.rejects(db.exec(`update residence_pilot_operator_slots set can_issue_certificates=true where role_code='boundary_field_reviewer'`),/check constraint/);
 await db.query(`insert into residence_pilot_release_approvals(approval_code,document_reference,approved_by,approved_at,boundary_reference,boundary_version,boundary_artifact_sha256)
 values('boundary','SYNTHETIC, NOT A GEOGRAPHICAL APPROVAL',$1,now(),$2,$3,$4)`,[fieldReviewer,config.boundary_reference,config.boundary_version,'a'.repeat(64)]);
 for(const code of ['privacy','authentication','sms']){
  assert.equal((await call(authority,'configure',null,config)).reason,'release_not_ready');
  await db.query(`insert into residence_pilot_release_approvals(approval_code,document_reference,approved_by,approved_at,retention_reference) values($1,'SYNTHETIC TEST ONLY',$2,now(),'SYNTHETIC RETENTION')`,[code,authority]);
 }
 assert.equal((await status()).ready,true);
 assert.equal((await call(authority,'configure',null,{...config,boundary_version:'draft-other-version'})).reason,'release_not_ready');
 assert.equal((await call(authority,'configure',null,{...config,boundary_reference:'OTHER-MAP'})).reason,'release_not_ready');
 await db.exec('begin');
 await db.exec(`update residence_pilot_release_approvals set approved_at=now()+interval '1 hour' where approval_code='boundary'`);
 assert.equal((await status()).ready,false);await db.exec('rollback');
 assert.equal((await call(otherAdmin,'person',owner,{adult_verified:true,full_name:'Synthetic',evidence_reference:'TEST-ID'})).reason,'nominated_authority_required');
});
test('only authority can configure and verify adults; self-verification is denied',async()=>{

 assert.equal((await call(owner,'configure',null,config)).ok,false);assert.equal((await call(authority,'configure',null,config)).ok,true);
 assert.equal((await call(authority,'person',authority,{adult_verified:true,full_name:'Self',evidence_reference:'DOC-1'})).ok,false);
 for(const [index,id] of [owner,w1,w2].entries()){
  assert.equal((await call(authority,'person',id,{adult_verified:true,full_name:`Test adult ${index}`,evidence_reference:`DOC-${index}`,local_reference:id===w1?'VISIT-1':''})).ok,true);
  await db.query('insert into account_verified_phones(user_id,phone) values($1,$2)',[id,`+24492345678${index}`]);
 }
});
test('request binds owner and record; enrollment requires consent and reviewed identity',async()=>{
 assert.equal((await call(stranger,'create',otherRecord,{consent:true,address_label:'Casa teste'})).ok,false);
 assert.equal((await call(owner,'create',otherRecord,{consent:true,address_label:'Casa teste'})).ok,false);
 assert.equal((await call(owner,'create',record,{consent:false,address_label:'Casa teste'})).ok,false);
 const r=await call(owner,'create',record,{consent:true,address_label:'Rua teste, casa 1'});assert.equal(r.ok,true);request=r.id;
 assert.equal((await call(owner,'create',record,{consent:true,address_label:'Casa teste'})).reason,'existing_request');
 assert.equal((await call(stranger,'list')).requests.length,0);
});
test('invites have an authenticated recipient, persistent resend limits and private phone',async()=>{
 assert.equal((await call(stranger,'invite',request,{phone:'+244923456781',consent:true})).ok,false);
 assert.equal((await call(owner,'invite',request,{phone:'+244923456780',consent:true})).ok,false);
 let r=await call(owner,'invite',request,{phone:'+244923456781',consent:true});assert.equal(r.ok,true);inv1=r.invitation_id;
 r=await call(owner,'invite',request,{phone:'+244923456782',consent:true});assert.equal(r.ok,true);inv2=r.invitation_id;
 assert.equal((await call(owner,'invite',request,{phone:'+244923456781',consent:true})).reason,'try_later');
 assert.equal((await call(owner,'send_result',inv1,{accepted:false})).ok,true);
 assert.equal((await call(owner,'list')).requests[0].invitations[0].phone,undefined);
 assert.equal((await call(w1,'list')).invitations.length,1);
});
const declaration={answer:'confirm',knows_person:true,knows_residence:true,same_household:false,relationship:'Vizinho',known_since:'2020-01-01',consent:true};
test('declaration is immutable, account-bound and requires residence knowledge separately',async()=>{
 assert.equal((await call(stranger,'declare',inv1,declaration)).ok,false);
 assert.equal((await call(w1,'declare',inv1,{...declaration,knows_residence:false})).reason,'residence_required');
 assert.equal((await call(w1,'declare',inv1,declaration)).ok,true);
 assert.equal((await call(w1,'declare',inv1,declaration)).reason,'already_declared');
 assert.equal((await call(w2,'declare',inv2,declaration)).ok,true);
});
const review={inside_boundary_reviewed:true,evidence_reviewed:true,note:'Visita e mapa conferidos pela autoridade.'};
test('issuance needs independent authority, exact record, two witnesses and manual perimeter review',async()=>{
 assert.equal((await call(owner,'issue',request,review)).ok,false);
 assert.equal((await call(otherAdmin,'issue',request,review)).reason,'nominated_authority_required');
 assert.equal((await call(authority,'issue',request,{note:'Missing review'})).reason,'review_required');
 await db.query("update residence_pilot_declarations set same_household=true where invitation_id=$1",[inv2]);
 assert.equal((await call(authority,'issue',request,review)).ok,false);
 await db.query("update residence_pilot_declarations set same_household=false where invitation_id=$1",[inv2]);
 await db.query("update afroloc_records set updated_at=updated_at+interval '1 second' where id=$1",[record]);
 assert.equal((await call(authority,'issue',request,review)).reason,'address_changed');
 await db.query('update afroloc_records set updated_at=(select record_updated_at from residence_pilot_requests where id=$1) where id=$2',[request,record]);
 const r=await call(authority,'issue',request,review);assert.equal(r.ok,true);cert=r.certificate_id;assert.ok(cert);
 assert.equal((await call(authority,'issue',request,review)).ok,false);
 assert.equal((await db.query('select residence_relationship from partner_certificates where id=$1',[cert])).rows[0].residence_relationship,'resident');
});
test('existing partner flow consumes residence certificate and live evidence, never property ownership',async()=>{
 grant=(await link('begin',{subject:partner,code:'TEST-LAR',hash:'a'.repeat(64)})).request_id;
 assert.equal((await link('approve',{actor:owner,id:grant,code:'TEST-LAR',consent:true})).ok,true);
 const r=await link('exchange',{subject:partner,id:grant,hash:'a'.repeat(64)});assert.equal(r.certified,true);assert.equal(r.relationship,'resident');
 await db.query('update account_verified_phones set revoked_at=now() where user_id=$1',[w1]);assert.equal((await link('status',{subject:partner,id:grant})).ok,false);
 await db.query('update account_verified_phones set revoked_at=null where user_id=$1',[w1]);assert.equal((await link('status',{subject:partner,id:grant})).ok,true);
});
test('changed or revoked approvals and suspended authority close the pilot and revoke live partner evidence',async()=>{
 for(const query of [
  `update residence_pilot_release_approvals set revoked_at=now() where approval_code='privacy'`,
  `update residence_pilot_release_approvals set document_reference='SYNTHETIC REPLACEMENT' where approval_code='boundary'`,
  `update residence_pilot_operator_slots set status='suspended',can_issue_certificates=false where role_code='residence_authority_reviewer'`,
  `update residence_pilot_settings set enabled=false`,
 ]){
  await db.exec('begin');await db.exec(query);
  assert.equal((await call(owner,'list')).settings.enabled,false);
  assert.ok((await db.query('select revoked_at from partner_certificates where id=$1',[cert])).rows[0].revoked_at);
  assert.equal((await link('status',{subject:partner,id:grant})).ok,false);
  assert.equal((await call(w1,'withdraw_declaration',inv1)).ok,true);
  assert.equal((await call(authority,'revoke',request,{note:'Synthetic recovery'})).ok,true);
  assert.equal((await call(authority,'configure',null,{...config,enabled:false})).ok,true);
  await db.exec('rollback');
 }
});
test('loss of signatory admin role fails closed on positive actions and partner status',async()=>{
 await db.exec('begin');await db.query('delete from test_admins where id=$1',[authority]);
 assert.equal((await call(owner,'list')).release.ready,false);
 assert.equal((await call(owner,'invite',request,{phone:'+244923456781',consent:true})).reason,'release_not_ready');
 assert.equal((await link('status',{subject:partner,id:grant})).ok,false);
 await db.exec('rollback');
});
test('witness withdrawal immediately revokes certificate and partner benefit proof',async()=>{
 assert.equal((await call(stranger,'withdraw_declaration',inv1)).ok,false);
 assert.equal((await call(w1,'withdraw_declaration',inv1)).ok,true);
 assert.equal((await link('status',{subject:partner,id:grant})).ok,false);
 assert.ok((await db.query('select revoked_at from partner_certificates where id=$1',[cert])).rows[0].revoked_at);
});
test('service role can run the real RPC while anon and authenticated remain denied',async()=>{
 await db.exec('set role service_role');assert.equal((await call(owner,'list')).ok,true);await db.exec('reset role');
 assert.ok((await db.query("select count(*)::int n from residence_pilot_events where request_id=$1",[request])).rows[0].n>=5);
});
