import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const owner='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222', authority='33333333-3333-4333-8333-333333333333', client='44444444-4444-4444-8444-444444444444', record='55555555-5555-4555-8555-555555555555';
const code='EXACT-CERTIFICATE', hash='a'.repeat(64);
const call=async(action,args={})=>(await db.query('select public.partner_link_action($1,$2,$3,$4,$5,$6,$7,$8) as result',[action,args.actor??null,args.id??null,args.subject??null,args.code??null,args.hash??null,args.consent??false,args.expiry??null])).rows[0].result;
let certificate, link;
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);grant usage on schema public to anon,authenticated,service_role;
 create table public.afroloc_records(id uuid primary key,user_id uuid,code text,updated_at timestamptz not null default now());
 create table public.test_authorities(id uuid primary key);
 create type public.app_role as enum ('admin');create function public.has_role(u uuid,r public.app_role) returns boolean language sql as $$select exists(select 1 from public.test_authorities where id=u) and r='admin'$$;
 grant select on public.test_authorities to service_role;revoke execute on function public.has_role(uuid, public.app_role) from public;`);
 const path=new URL('../../supabase/migrations/',import.meta.url);
 for(const suffix of ['authorized_account_link.sql','partner_certificate_lifecycle.sql'])for(const file of readdirSync(path).filter(n=>n.endsWith(suffix)).sort())await db.exec(readFileSync(new URL(file,path),'utf8'));
});
beforeEach(async()=>{
 await db.exec(`begin;insert into auth.users values('${owner}'),('${other}'),('${authority}'),('${client}');insert into test_authorities values('${authority}');insert into afroloc_records(id,user_id,code)values('${record}','${owner}','${code}');insert into account_verified_phones(user_id,phone)values('${owner}','+244900000001');`);
 certificate=(await call('issue',{actor:authority,id:record,consent:true,expiry:new Date(Date.now()+86400000).toISOString()})).certificate_id;
 link=(await call('begin',{subject:client,code,hash})).request_id;
 assert.ok(certificate);assert.ok(link);
});
afterEach(async()=>{await db.exec('rollback;reset role');});
after(()=>db.close());
async function activate(){assert.equal((await call('approve',{actor:owner,id:link,code,consent:true})).ok,true);const value=await call('exchange',{subject:client,id:link,hash});assert.equal(value.certified,true);return value;}
const current=()=>call('status',{subject:client,id:link});

test('service role emits a versioned, exact owner binding without exposing the AFROLOC user or phone',async()=>{
 await db.exec('set role service_role');const value=await activate();
 assert.equal(value.version,1);assert.equal(value.relationship,'owner');assert.equal(value.status,'active');assert.equal(value.revoked_at,null);
 assert.equal(value.subject,client);assert.equal(value.link_id,link);assert.equal(value.evidence_id,certificate);assert.equal(value.code,code);
 assert.equal(JSON.stringify(value).includes(owner),false);assert.equal(JSON.stringify(value).includes('+244'),false);
});
for(const [name,sql] of [
 ['ownership transfer',`update afroloc_records set user_id='${other}'`],
 ['changed code',"update afroloc_records set code='OTHER'"],
 ['source revision',"update afroloc_records set updated_at=updated_at+interval '1 second'"],
 ['lost issuer authority','delete from test_authorities'],
 ['future certificate',"update partner_certificates set issued_at=now()+interval '1 hour'"],
 ['expired certificate',"update partner_certificates set issued_at=now()-interval '2 days',expires_at=now()-interval '1 second'"],
 ['revoked certificate','update partner_certificates set revoked_at=now()'],
 ['revoked phone','update account_verified_phones set revoked_at=now()'],
 ['expired phone',"update account_verified_phones set expires_at=now()-interval '1 second'"],
 ['expired consent',"update partner_account_links set expires_at=now()-interval '1 second'"],
 ['missing consent expiry','update partner_account_links set expires_at=null'],
 ['future consent',"update partner_account_links set consent_at=now()+interval '1 hour'"],
])test(`${name} invalidates a previously successful observation`,async()=>{
 await activate();await db.exec(sql);const value=await current();assert.equal(value.ok,false);assert.notEqual(value.certified,true);
});
test('issuer authority and not-before are checked before consent is accepted',async()=>{
 await db.exec('delete from test_authorities');assert.equal((await call('approve',{actor:owner,id:link,code,consent:true})).ok,false);
 await db.exec(`insert into test_authorities values('${authority}');update partner_certificates set issued_at=now()+interval '1 hour'`);
 assert.equal((await call('inspect',{actor:owner,id:link})).ok,false);
 assert.equal((await call('approve',{actor:owner,id:link,code,consent:true})).ok,false);
});
test('shorter phone validity bounds the returned evidence lifetime',async()=>{
 await db.exec("update account_verified_phones set expires_at=now()+interval '30 seconds'");const value=await activate();
 assert.ok(Date.parse(value.expires_at)-Date.parse(value.checked_at)<=30000);
});
for(const [action,actorArgs] of [['revoke_user',{actor:owner}],['revoke_partner',{subject:client}],['revoke_certificate',{actor:authority}]])test(`${action} blocks status and replay immediately`,async()=>{
 await activate();assert.equal((await call(action,{...actorArgs,id:action==='revoke_certificate'?certificate:link})).ok,true);
 assert.equal((await current()).ok,false);assert.equal((await call('exchange',{subject:client,id:link,hash})).ok,false);
});
test('unauthorized revocation does not damage a valid certificate',async()=>{
 await activate();assert.equal((await call('revoke_certificate',{actor:other,id:certificate})).ok,false);
 assert.equal((await call('revoke_user',{actor:other,id:link})).ok,false);assert.equal((await call('revoke_partner',{subject:other,id:link})).ok,false);
 assert.equal((await current()).certified,true);
});
test('expired, overlong and self-issued certificates are refused',async()=>{
 for(const expiry of [new Date(Date.now()-1000).toISOString(),new Date(Date.now()+91*86400000).toISOString(),null])assert.equal((await call('issue',{actor:authority,id:record,consent:true,expiry})).ok,false);
 await db.exec(`update afroloc_records set user_id='${authority}'`);assert.equal((await call('issue',{actor:authority,id:record,consent:true,expiry:new Date(Date.now()+86400000).toISOString()})).ok,false);
});
test('missing certificate revocation is not falsely audited as successful',async()=>{
 assert.equal((await call('revoke_certificate',{actor:authority,id:crypto.randomUUID()})).ok,false);
 assert.equal((await db.query("select count(*)::int as n from account_security_events where event='partner_certificate_revoked'")).rows[0].n,0);
});
test('browser roles cannot forge, change, delete or read evidence and cannot invoke authority RPC',async()=>{
 for(const role of ['anon','authenticated']){
  // Failed SQL aborts a transaction; use a savepoint for each negative boundary.
  await db.exec(`set role ${role}`);
  for(const sql of ['select * from partner_certificates','update partner_certificates set revoked_at=null','delete from partner_certificates',`insert into partner_certificates(record_id,subject,code,issued_by,record_updated_at,expires_at)values('${record}','${other}','FAKE','${other}',now(),now()+interval '1 day')`,"select partner_link_action('list_user')"]){
   await db.exec('savepoint denied');await assert.rejects(db.exec(sql),/permission denied/);await db.exec('rollback to savepoint denied');
  }
  await db.exec('reset role');
 }
});
