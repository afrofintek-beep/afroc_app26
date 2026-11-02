import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const ids=Array.from({length:8},(_,n)=>`${n+1}1111111-1111-4111-8111-111111111111`);
const [owner,w1,w2,authority,stranger,record,partner,otherRecord]=ids;
const call=async(actor,action,id=null,data={})=>(await db.query('select residence_pilot_action($1,$2,$3,$4) result',[actor,action,id,JSON.stringify(data)])).rows[0].result;
const link=async(action,args={})=>(await db.query('select partner_link_action($1,$2,$3,$4,$5,$6,$7,$8) result',[action,args.actor??null,args.id??null,args.subject??null,args.code??null,args.hash??null,args.consent??false,args.expiry??null])).rows[0].result;
let request,inv1,inv2,cert,grant;
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);grant usage on schema public to anon,authenticated,service_role;create type public.app_role as enum ('admin');create function public.has_role(u uuid,r public.app_role) returns boolean language sql as $$select u='${authority}'::uuid and r='admin'$$;create table afroloc_records(id uuid primary key,user_id uuid,code text,country text default 'AO',updated_at timestamptz not null default now());`);
 for(const id of ids)await db.query('insert into auth.users values($1)',[id]);
 await db.query('insert into afroloc_records(id,user_id,code) values($1,$2,$3),($4,$5,$6)',[record,owner,'TEST-LAR',otherRecord,stranger,'OTHER']);
 const dir=new URL('../../supabase/migrations/',import.meta.url);
 for(const suffix of ['authorized_account_link.sql','partner_certificate_lifecycle.sql','lar_patriota_workflow.sql'])for(const f of readdirSync(dir).filter(x=>x.endsWith(suffix)).sort())await db.exec(readFileSync(new URL(f,dir),'utf8'));
});
after(()=>db.close());
test('pilot starts closed, public roles cannot read or mutate data or spoof an actor',async()=>{
 assert.equal((await call(owner,'create',record,{consent:true,address_label:'Rua teste, casa 1'})).reason,'pilot_closed');
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  for(const table of ['settings','people','requests','invitations','declarations','events'])await assert.rejects(db.query(`select * from residence_pilot_${table}`),/permission denied/);
  await assert.rejects(call(authority,'configure',null,{}),/permission denied/);await db.exec('reset role');
 }
});
test('only authority can configure and verify adults; self-verification is denied',async()=>{
 const config={enabled:true,boundary_reference:'MAP-APPROVED-1',boundary_version:'v1'};
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
