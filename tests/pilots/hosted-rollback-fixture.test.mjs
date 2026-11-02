import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('hosted rollback script executes locally and leaves no synthetic approvals, users or certificates',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`
   create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
   create type public.app_role as enum ('admin');
   create table public.user_roles(user_id uuid,role public.app_role);
   create function public.has_role(u uuid,r public.app_role) returns boolean language sql security definer set search_path=public,pg_temp
    as $$select exists(select 1 from public.user_roles where user_id=u and role=r)$$;
   create table public.afroloc_records(id uuid primary key,user_id uuid,code text,country text,updated_at timestamptz,is_primary_residence boolean);
   grant usage on schema public to anon,authenticated,service_role;
   grant select on public.afroloc_records to service_role;
  `);
  const dir=new URL('../../supabase/migrations/',import.meta.url);
  for(const suffix of ['authorized_account_link.sql','partner_certificate_lifecycle.sql','lar_patriota_workflow.sql','lar_patriota_release_gates.sql']){
   for(const file of readdirSync(dir).filter(f=>f.endsWith(suffix)).sort())await db.exec(readFileSync(new URL(file,dir),'utf8'));
  }
  const results=await db.exec(readFileSync(new URL('./hosted-rollback.sql',import.meta.url),'utf8'));
  const result=results.at(-1).rows[0].verification;
  assert.equal(result.result,'PASS');
  for(const key of ['approvals','assigned_operators','people','requests','invitations','certificates'])assert.equal(result[key],0,key);
  assert.equal(result.pilot_enabled,false);
  assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,0);
 }finally{await db.close();}
});
