import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,deleted_at timestamptz,is_anonymous boolean DEFAULT false,phone text,phone_confirmed_at timestamptz);
 CREATE TABLE public.afroloc_records(id uuid PRIMARY KEY,code text,country text,user_id uuid,status text,geo_lat double precision,geo_lon double precision,is_temporary boolean DEFAULT false,temporary_expires_at timestamptz,level2_name text,level4_name text,street_name text,number text,unit text);
 CREATE TABLE public.afroloc_witnesses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),afroloc_record_id uuid REFERENCES public.afroloc_records(id),witness_user_id uuid REFERENCES auth.users(id),witness_afro_id text,status text,signature text,confirmed_at timestamptz,otp_code text,otp_expires_at timestamptz,otp_sent_at timestamptz,rejection_reason text,created_at timestamptz DEFAULT now());
 CREATE TABLE public.afroloc_validations(afroloc_record_id uuid,validation_method text);
 CREATE TABLE public.account_verified_phones(user_id uuid,phone text,verified_at timestamptz DEFAULT now(),expires_at timestamptz,revoked_at timestamptz);
 CREATE TABLE public.postal_stations(station text PRIMARY KEY,province_code text,municipio_code text,name text,status text,notes text,updated_at timestamptz);
 CREATE TABLE public.administrative_divisions(country_code text,code text,level integer,parent_code text);
 INSERT INTO public.postal_stations(station,province_code,municipio_code,status) VALUES('5051500','AO-LUA','AO-LUA-TALATONA','planned');
 INSERT INTO public.administrative_divisions VALUES('AO','AO-LDA-TALATONA',2,'AO-LDA');
`);
const migration=await fs.readFile(new URL('../../supabase/migrations/20261109020721_witness_confirmation_v2_and_talatona_postal.sql',import.meta.url),'utf8');
await db.exec(migration);
const uid=i=>`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
for(let i=1;i<=6;i++){await db.query('insert into auth.users(id,phone,phone_confirmed_at) values($1,$2,now())',[uid(i),'+24490000000'+i]);await db.query(`insert into public.afroloc_records(id,code,country,user_id,status,geo_lat,geo_lon,is_temporary,temporary_expires_at) values($1,$2,'AO',$3,$4,-8.92,13.2,$5,now()+interval '1 month')`,[uid(i+100),'CODE'+i,uid(i),i===1?'draft':'verified',i===1]);await db.query("insert into public.afroloc_validations values($1,'authority')",[uid(i+100)]);}
await db.exec('GRANT USAGE ON SCHEMA public,auth TO service_role; GRANT SELECT,INSERT,UPDATE ON public.afroloc_records,public.afroloc_witnesses,public.afroloc_validations,public.account_verified_phones TO service_role;');
await db.exec("set request.jwt.claims='{\"role\":\"service_role\"}';");
const rpc=async(actor,action,payload)=>{await db.exec('SET ROLE service_role');try{return(await db.query('select public.witness_confirmation_v2($1,$2,$3::jsonb) result',[actor,action,JSON.stringify(payload)])).rows[0].result;}finally{await db.exec('RESET ROLE')}};
const request=i=>rpc(uid(1),'request',{record_id:uid(101),code:'CODE'+i,consent:true});
assert.equal((await rpc(uid(2),'request',{record_id:uid(101),code:'CODE3',consent:true})).ok,false);
assert.equal((await request(1)).ok,false);
const first=await request(2);assert.equal(first.ok,true);const duplicate=await request(2);assert.equal(duplicate.witness_id,first.witness_id);
const second=await request(3),third=await request(4);assert.equal(third.ok,true);assert.equal((await request(5)).ok,false);
assert.equal((await rpc(uid(6),'info',{witness_id:first.witness_id})).ok,false);
const hash='a'.repeat(64),salt=uid(500);
await assert.rejects(db.query("update public.afroloc_witnesses set status='confirmed' where id=$1",[first.witness_id]),/confirmação pessoal/);
const begin=wid=>rpc(uid(1),'prepare',{witness_id:wid,otp_hash:hash,salt,auth_verified_phone:'+244900000002'});
let prepared=await begin(first.witness_id);assert.equal(prepared.ok,true);assert.equal((await begin(first.witness_id)).ok,false);
const verify=(actor,wid,challenge_id,otp_hash=hash)=>rpc(actor,'verify',{witness_id:wid,challenge_id,otp_hash,full_name:'Pessoa de teste',signature:'Pessoa de teste',consent:true});
assert.equal((await verify(uid(2),first.witness_id,prepared.challenge_id)).ok,false); // not delivered
await rpc(uid(1),'delivery',{witness_id:first.witness_id,challenge_id:prepared.challenge_id,accepted:true});
assert.equal((await verify(uid(1),first.witness_id,prepared.challenge_id)).ok,false); // owner cannot sign
for(let i=0;i<5;i++)assert.equal((await verify(uid(2),first.witness_id,prepared.challenge_id,'b'.repeat(64))).ok,false);
assert.equal((await verify(uid(2),first.witness_id,prepared.challenge_id)).ok,false); // locked
await db.query("update public.afroloc_witness_challenges set last_sent_at=now()-interval '2 minutes' where witness_id=$1",[first.witness_id]);
prepared=await begin(first.witness_id);await rpc(uid(1),'delivery',{witness_id:first.witness_id,challenge_id:prepared.challenge_id,accepted:true});
assert.equal((await verify(uid(2),first.witness_id,prepared.challenge_id)).ok,true);
assert.equal((await verify(uid(2),first.witness_id,prepared.challenge_id)).ok,false); // consumed
for(const [row,user] of [[second,3],[third,4]]){const c=await begin(row.witness_id);await rpc(uid(1),'delivery',{witness_id:row.witness_id,challenge_id:c.challenge_id,accepted:true});if(user===3){await db.query("update public.afroloc_witness_challenges set expires_at=now()-interval '1 minute' where witness_id=$1",[row.witness_id]);assert.equal((await verify(uid(user),row.witness_id,c.challenge_id)).ok,false);await db.query("update public.afroloc_witness_challenges set expires_at=now()+interval '10 minutes' where witness_id=$1",[row.witness_id]);}assert.equal((await verify(uid(user),row.witness_id,c.challenge_id)).ok,true);}
assert.equal((await db.query("select count(distinct witness_user_id)::int n from public.afroloc_witnesses where status='confirmed'")).rows[0].n,3);
assert.equal((await db.query('select status from public.afroloc_records where id=$1',[uid(101)])).rows[0].status,'draft');
const station=(await db.query("select * from public.postal_stations where station='5051500'")).rows[0];assert.equal(station.status,'active');assert.equal(station.municipio_code,'AO-LDA-TALATONA');
await db.exec("set request.jwt.claims='{\"role\":\"authenticated\"}';");
await assert.rejects(db.query("update public.afroloc_witnesses set status='pending' where id=$1",[first.witness_id]),/serviço AFROLOC/);
await db.exec('SET ROLE authenticated;');
await assert.rejects(db.query('select * from public.afroloc_witness_challenges'),/permission denied/);
await assert.rejects(db.query('select public.witness_confirmation_v2($1,$2,$3::jsonb)',[uid(1),'info',JSON.stringify({witness_id:first.witness_id})]),/permission denied/);
await db.close();
console.log('PASS SQL: owner-only requests, no self-witness, duplicate idempotency, cap of 3, private challenges/RPC, wrong owner, undelivered/expired/locked OTP, replay prevention, 3 independent confirmations, official status remains draft, Talatona keeps station 5051500, protected status writes.');
