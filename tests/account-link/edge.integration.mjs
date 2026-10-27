// Run with YAMILOOK_REPO pointing to the matching checkout. No real network/SMS.
import assert from 'node:assert/strict';import {readFileSync,readdirSync,mkdirSync} from 'node:fs';import {resolve} from 'node:path';
import {build} from 'esbuild';import {PGlite} from '@electric-sql/pglite';
const yroot=process.env.YAMILOOK_REPO;if(!yroot)throw new Error('Set YAMILOOK_REPO to the matching Yamilook checkout');
const aroot=process.cwd(), sdk=process.env.ACCOUNT_LINK_TEST_SDK;if(!sdk)throw new Error('Set ACCOUNT_LINK_TEST_SDK to installed @supabase/supabase-js@2.90.1/dist/index.mjs');
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',authority='33333333-3333-4333-8333-333333333333',local='44444444-4444-4444-8444-444444444444',record='55555555-5555-4555-8555-555555555555';
const code='OPAQUE-TEST', key='test-partner-key-'.repeat(3),pepper='test-pepper-'.repeat(4),databases={ao:new PGlite(),ya:new PGlite()};
for(const [name,db] of Object.entries(databases)){
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);grant usage on schema public to service_role;insert into auth.users values('${owner}'),('${other}'),('${authority}'),('${local}');`);
 if(name==='ao')await db.exec(`create table public.afroloc_records(id uuid primary key,user_id uuid,code text,updated_at timestamptz not null default now());create type public.app_role as enum ('admin');create function public.has_role(u uuid,r public.app_role) returns boolean language sql as $$select u='${authority}'::uuid and r='admin'$$;insert into public.afroloc_records(id,user_id,code)values('${record}','${owner}','${code}');`);
 else await db.exec(`create table public.profiles(id uuid primary key,afroloc_code text);insert into public.profiles values('${local}','${code}');`);
 const root=name==='ao'?aroot:yroot,path=resolve(root,'supabase/migrations'),file=readdirSync(path).find(n=>n.endsWith('authorized_account_link.sql'));await db.exec(readFileSync(resolve(path,file),'utf8'));
 if(name==='ao')for(const extra of readdirSync(path).filter(n=>n.endsWith('partner_certificate_lifecycle.sql')).sort())await db.exec(readFileSync(resolve(path,extra),'utf8'));
}
let env={},handler,otpByPhone={},providerFails=false,partnerFails=false,afterPartnerCheck=null;
globalThis.Deno={env:{get:n=>env[n]},serve:h=>{handler=h}};
const out=resolve('/tmp','account-link-http-tests');mkdirSync(out,{recursive:true});
const handlers={};
for(const [label,root,fn] of [['aophone',aroot,'account-phone'],['yphone',yroot,'account-phone'],['authority',aroot,'account-link-authority'],['client',yroot,'account-link']]){
 const file=resolve(out,label+'.mjs');await build({entryPoints:[resolve(root,'supabase/functions',fn,'index.ts')],outfile:file,bundle:true,platform:'node',format:'esm',plugins:[{name:'exact-sdk',setup(b){b.onResolve({filter:/^npm:@supabase\/supabase-js@2\.90\.1$/},()=>({path:sdk}));}}]});
 await import(file);handlers[label]=handler;
}
function environment(name){return {ACCOUNT_LINK_V1_ENABLED:'true',SUPABASE_URL:`https://${name}.supabase.co`,SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-service',ACCOUNT_LINK_PARTNER_KEY:key,ACCOUNT_PHONE_OTP_PEPPER:pepper,INFOBIP_BASE_URL:'https://test.api.infobip.com',INFOBIP_API_KEY:'fixture',INFOBIP_SENDER:'TEST',AFROLOC_LINK_ENDPOINT:'https://ao.supabase.co/functions/v1/account-link-authority'};}
async function run(label,input,user=local,extra={}){
 const saved=env;env={...environment(label==='authority'||label==='aophone'?'ao':'ya'),...extra};try{
 const res=await handlers[label](new Request('https://test.local',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${user}`},body:JSON.stringify(input)}));return {status:res.status,data:await res.json()};
 }finally{env=saved;}
}
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
globalThis.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url??input.href),headers=new Headers(init.headers),method=init.method??'GET';
 if(url.hostname==='test.api.infobip.com'){
  if(providerFails)return response({error:'mock rejection'},500);
  const data=JSON.parse(init.body),m=data.messages[0];otpByPhone['+'+m.destinations[0].to]=m.text.match(/\d{6}/)[0];return response({messages:[{status:{groupName:'PENDING'}}]});
 }
 const name=url.hostname.split('.')[0],db=databases[name];if(!db)throw new Error('Unexpected network URL: '+url.origin);
 if(url.pathname==='/auth/v1/user'){
  const id=headers.get('Authorization')?.replace('Bearer ','');if(![owner,other,authority,local].includes(id))return response({message:'invalid'},401);return response({id,is_anonymous:false});
 }
 if(url.pathname==='/functions/v1/account-link-authority'){
  if(partnerFails)throw new Error('Simulated partner outage');
  const saved=env;env=environment('ao');try{
   const response=await handlers.authority(new Request(url,{...init}));
   const data=await response.clone().json();
   if(data.certified===true&&afterPartnerCheck){const hook=afterPartnerCheck;afterPartnerCheck=null;await hook();}
   return response;
  }finally{env=saved;}
 }
 if(url.pathname.startsWith('/rest/v1/rpc/')){
  const fn=url.pathname.split('/').pop(),args=JSON.parse(init.body);
  if(!['account_phone_action','partner_link_action'].includes(fn))throw new Error('unexpected RPC');
  const entries=Object.entries(args);try{const result=await db.query(`select public.${fn}(${entries.map(([k],i)=>`${k}=>$${i+1}`).join(',')}) as result`,entries.map(x=>x[1]));return response(result.rows[0].result);}catch(e){return response({message:e.message},400);}
 }
 const table=url.pathname.split('/').pop();if(!['profiles','afroloc_link_requests'].includes(table))throw new Error('Unexpected table');
 const params=[],where=[];
 for(const [k,v] of url.searchParams){if(['select','order','limit'].includes(k))continue;if(!['id','user_id','revoked_at'].includes(k))throw new Error('Unexpected filter');if(v==='is.null')where.push(`${k} is null`);else if(v.startsWith('eq.')){params.push(v.slice(3));where.push(`${k}=$${params.length}`);}else throw new Error('Unexpected operator');}
 if(method==='GET'){
  const cols=url.searchParams.get('select')??'*';if(!/^[a-z_,*]+$/.test(cols))throw new Error('Unexpected columns');
  let sql=`select ${cols} from ${table}`+(where.length?' where '+where.join(' and '):'');if(url.searchParams.get('order'))sql+=' order by created_at desc';if(url.searchParams.get('limit'))sql+=' limit 10';
  const result=await db.query(sql,params);if(headers.get('Accept')?.includes('vnd.pgrst.object'))return result.rows.length===1?response(result.rows[0]):response({message:'not found'},406);return response(result.rows);
 }
 const values=JSON.parse(init.body);if(!Object.keys(values).every(k=>['id','user_id','code','verifier','linked_at','revoked_at'].includes(k)))throw new Error('Unexpected mutation');
 if(method==='POST'){const entries=Object.entries(values);await db.query(`insert into ${table}(${entries.map(x=>x[0]).join(',')})values(${entries.map((_,i)=>'$'+(i+1)).join(',')})`,entries.map(x=>x[1]));return response(null,201);}
 if(method==='PATCH'){const entries=Object.entries(values),set=entries.map(([k,v])=>{params.push(v);return `${k}=$${params.length}`;});await db.query(`update ${table} set ${set.join(',')} where ${where.join(' and ')}`,params);return new Response(null,{status:204});}
 throw new Error('Unexpected method');
};
try{
 assert.equal((await run('yphone',{action:'status'},'invalid')).status,401);
 assert.equal((await run('client',{action:'begin',code,consent:true},local,{ACCOUNT_LINK_V1_ENABLED:'false'})).status,503);
 assert.equal((await run('yphone',{action:'begin',phone:'+244923456789',consent:false})).data.ok,false);
 for(const [label,user,phone] of [['yphone',local,'+244923456789'],['aophone',owner,'+243812345678']]){
  const start=(await run(label,{action:'begin',phone,consent:true},user)).data;assert.equal(start.ok,true);
  assert.equal((await run(label,{action:'verify',challenge_id:start.challenge_id,otp:otpByPhone[phone]},other)).data.ok,false);
  assert.equal((await run(label,{action:'verify',challenge_id:start.challenge_id,otp:otpByPhone[phone]},user)).data.verified,true);
 }
 const cert=(await run('authority',{action:'issue',id:record,consent:true,expires_at:new Date(Date.now()+86400000).toISOString()},authority)).data;assert.equal(cert.ok,true);
 const start=(await run('client',{action:'begin',code,consent:true})).data;assert.equal(start.ok,true);assert.ok(start.authorization_url.startsWith('https://www.afroloc.ao/account-link#request='));
 assert.equal((await run('authority',{action:'approve',id:start.request_id,code,consent:true},other)).data.ok,false);
 assert.equal((await run('authority',{action:'approve',id:start.request_id,code,consent:false},owner)).data.ok,false);
 assert.equal((await run('authority',{action:'approve',id:start.request_id,code,consent:true},owner)).data.ok,true);
 assert.equal((await run('client',{action:'exchange',id:start.request_id},other)).data.ok,false);
 assert.equal((await run('client',{action:'exchange',id:start.request_id})).data.certified,true);
 assert.equal((await run('client',{action:'status',id:start.request_id})).data.certified,true);
 // Mutate local state after the authority has issued a positive observation.
 for(const [change,restore] of [
  ["update account_verified_phones set revoked_at=now()","update account_verified_phones set revoked_at=null"],
  ["update afroloc_link_requests set revoked_at=now()","update afroloc_link_requests set revoked_at=null"],
  ["update profiles set afroloc_code='CHANGED'",`update profiles set afroloc_code='${code}'`],
 ]){
  afterPartnerCheck=()=>databases.ya.exec(change);
  assert.equal((await run('client',{action:'status',id:start.request_id})).data.certified,false);
  await databases.ya.exec(restore);
 }
 await run('authority',{action:'revoke_certificate',id:cert.certificate_id},authority);
 assert.equal((await run('client',{action:'status',id:start.request_id})).data.certified,false);
 partnerFails=true;
 assert.equal((await run('client',{action:'revoke',id:start.request_id})).status,503);
 assert.equal((await run('client',{action:'status',id:start.request_id})).data.reason,'revoked');
 partnerFails=false;
 assert.equal((await run('client',{action:'revoke',id:start.request_id})).data.ok,true);
 providerFails=true;const failed=await run('yphone',{action:'begin',phone:'+242061234567',consent:true},other);assert.equal(failed.status,503);
 const pending=await databases.ya.query('select count(*)::int as n from account_phone_challenges where user_id=$1 and consumed_at is null',[other]);assert.equal(pending.rows[0].n,0);
 console.log('PASS: HTTP handlers + both SQL schemas: independent OTP, consent, cross-account denial, grant exchange, current certificate, in-flight local phone/link/address changes, revocation during partner outage and SMS failure. No real network or SMS.');
}finally{await Promise.all(Object.values(databases).map(db=>db.close()));}
