import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',authority='33333333-3333-4333-8333-333333333333',client='44444444-4444-4444-8444-444444444444',record='55555555-5555-4555-8555-555555555555';
const code='OPAQUE-TEST',hash='a'.repeat(64);
const call=async (action,args={})=>(await db.query('select public.partner_link_action($1,$2,$3,$4,$5,$6,$7,$8) as result',[action,args.actor??null,args.id??null,args.subject??null,args.code??null,args.hash??null,args.consent??false,args.expiry??null])).rows[0].result;
const phone=async (actor,action,args={})=>(await db.query('select public.account_phone_action($1,$2,$3,$4,$5) as result',[actor,action,args.id??null,args.phone??null,args.digest??null])).rows[0].result;
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);grant usage on schema public to anon,authenticated,service_role;create table public.afroloc_records(id uuid primary key,user_id uuid,code text,updated_at timestamptz not null default now());create function public.has_role(u uuid,r text) returns boolean language sql as $$select u='${authority}'::uuid and r='admin'$$;insert into auth.users values('${owner}'),('${other}'),('${authority}'),('${client}');insert into public.afroloc_records(id,user_id,code)values('${record}','${owner}','${code}');`);
 const path=new URL('../../supabase/migrations/',import.meta.url);const file=readdirSync(path).find(n=>n.endsWith('authorized_account_link.sql'));await db.exec(readFileSync(new URL(file,path),'utf8'));
});
after(()=>db.close());
let challenge,certificate,link;
test('phone challenge belongs to one UUID; wrong OTP counts and replay fails',async()=>{
 challenge=crypto.randomUUID();assert.equal((await phone(owner,'begin',{id:challenge,phone:'+244923456789',digest:hash})).ok,true);
 assert.equal((await phone(other,'verify',{id:challenge,digest:hash})).ok,false);
 assert.equal((await phone(owner,'verify',{id:challenge,digest:hash})).ok,false); // not delivered
 await phone(owner,'delivered',{id:challenge});
 assert.equal((await phone(owner,'verify',{id:challenge,digest:'b'.repeat(64)})).ok,false);
 assert.equal((await phone(owner,'verify',{id:challenge,digest:hash})).verified,true);
 assert.equal((await phone(owner,'verify',{id:challenge,digest:hash})).ok,false);
 assert.equal((await phone(owner,'status')).verified,true);
});
test('duplicate phone cannot merge or replace another account',async()=>{
 const id=crypto.randomUUID();await phone(other,'begin',{id,phone:'+244923456789',digest:hash});await phone(other,'delivered',{id});
 assert.equal((await phone(other,'verify',{id,digest:hash})).ok,false);
 assert.equal((await phone(owner,'status')).verified,true);assert.equal((await phone(other,'status')).verified,false);
});
test('rate limit persists and certificate issuance requires authority review',async()=>{
 assert.equal((await phone(owner,'begin',{id:crypto.randomUUID(),phone:'+243923456789',digest:hash})).reason,'try_later');
 assert.equal((await call('issue',{actor:owner,id:record,consent:true,expiry:new Date(Date.now()+86400000).toISOString()})).ok,false);
 assert.equal((await call('issue',{actor:authority,id:record,expiry:new Date(Date.now()+86400000).toISOString()})).ok,false);
 certificate=(await call('issue',{actor:authority,id:record,consent:true,expiry:new Date(Date.now()+86400000).toISOString()})).certificate_id;assert.ok(certificate);
});
test('request is bound to subject, code, explicit consent and verifier',async()=>{
 link=(await call('begin',{subject:client,code,hash})).request_id;assert.ok(link);
 assert.equal((await call('inspect',{actor:other,id:link})).ok,false);
 assert.equal((await call('approve',{actor:owner,id:link,code,consent:false})).ok,false);
 assert.equal((await call('approve',{actor:owner,id:link,code:'OTHER',consent:true})).ok,false);
 assert.equal((await call('approve',{actor:owner,id:link,code,consent:true})).ok,true);
 assert.equal((await call('exchange',{subject:other,id:link,hash})).ok,false);
 assert.equal((await call('exchange',{subject:client,id:link,hash:'b'.repeat(64)})).ok,false);
 const result=await call('exchange',{subject:client,id:link,hash});assert.equal(result.certified,true);assert.equal(result.code,code);assert.equal(result.subject,client);
 assert.equal((await call('exchange',{subject:client,id:link,hash})).ok,false);
 assert.equal((await call('status',{subject:client,id:link})).certified,true);
});
test('certificate expiry, record changes and revocation invalidate subsequent checks',async()=>{
 await db.query("update partner_certificates set expires_at=now()-interval '1 second',issued_at=now()-interval '1 day' where id=$1",[certificate]);
 assert.equal((await call('status',{subject:client,id:link})).ok,false);
 await db.query("update partner_certificates set expires_at=now()+interval '1 day' where id=$1",[certificate]);
 await db.query("update afroloc_records set updated_at=now()+interval '1 second' where id=$1",[record]);assert.equal((await call('status',{subject:client,id:link})).ok,false);
 await db.query('update afroloc_records set updated_at=(select record_updated_at from partner_certificates where id=$1) where id=$2',[certificate,record]);
 assert.equal((await call('revoke_certificate',{actor:other,id:certificate})).ok,false);
 assert.equal((await call('revoke_certificate',{actor:authority,id:certificate})).ok,true);
 assert.equal((await call('status',{subject:client,id:link})).ok,false);
});
test('revocation is scoped and never resurrects a link',async()=>{
 assert.equal((await call('revoke_user',{actor:other,id:link})).ok,false);
 assert.equal((await call('revoke_user',{actor:owner,id:link})).ok,true);
 assert.equal((await call('status',{subject:client,id:link})).ok,false);
 await phone(owner,'revoke');assert.equal((await phone(owner,'status')).verified,false);
});
test('public and authenticated roles cannot read evidence or call service RPCs',async()=>{
 for(const role of ['anon','authenticated']) {
  await db.exec(`set role ${role}`);
  await assert.rejects(db.query('select * from partner_account_links'),/permission denied/);
  await assert.rejects(call('begin',{subject:client,code,hash}),/permission denied/);
  await assert.rejects(phone(owner,'status'),/permission denied/);
  await db.exec('reset role');
 }
});
test('expired grants and exhausted or expired OTPs are denied',async()=>{
 const fresh='66666666-6666-4666-8666-666666666666';await db.query('insert into auth.users values($1)',[fresh]);
 const id=crypto.randomUUID();await phone(fresh,'begin',{id,phone:'+243812345678',digest:hash});await phone(fresh,'delivered',{id});
 for(let i=0;i<5;i++)assert.equal((await phone(fresh,'verify',{id,digest:'b'.repeat(64)})).ok,false);
 assert.equal((await phone(fresh,'verify',{id,digest:hash})).ok,false);
 await db.query("update account_phone_challenges set attempts=0,expires_at=now()-interval '1 second' where id=$1",[id]);
 assert.equal((await phone(fresh,'verify',{id,digest:hash})).ok,false);
 const pending=(await call('begin',{subject:fresh,code,hash})).request_id;
 await db.query("update partner_account_links set request_expires_at=now()-interval '1 second' where id=$1",[pending]);
 assert.equal((await call('inspect',{actor:owner,id:pending})).ok,false);
 assert.equal((await call('exchange',{subject:fresh,id:pending,hash})).ok,false);
 assert.equal((await db.query('select count(*)::int as count from auth.users')).rows[0].count,5);
});
