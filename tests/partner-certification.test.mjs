import test from 'node:test';
import assert from 'node:assert/strict';
import { partnerCertificationStatus as check } from '../supabase/functions/api-v1/partner-certification.ts';
const valid = { consent: true, phone: '+244923456789', code: 'TEST-OPAQUE' };
test('missing/wrong partner key cannot query accounts', () => {
  for (const [given,expected] of [[null,'key'],['bad','key'],['key',undefined]]) assert.equal(check(given,expected,valid).status,401);
});
test('consent must be explicit', () => {
  for (const consent of [undefined,false,'true',1]) assert.equal(check('key','key',{...valid,consent}).data.reason,'consent_required');
});
test('rejects local numbers, suffixes and missing/malformed addresses', () => {
  for (const phone of ['923456789','244923456789','+244 923456789','+000923456789']) assert.equal(check('key','key',{...valid,phone}).status,400);
  for (const code of ['',null,99,' TEST-OPAQUE ']) assert.equal(check('key','key',{...valid,code}).status,400);
});
test('same national suffix in different countries never certifies or reveals an address', () => {
  for (const phone of ['+244923456789','+243923456789','+242923456789']) {
    assert.deepEqual(check('key','key',{...valid,phone}),{status:503,data:{certified:false,reason:'integration_pending'}});
  }
});
test('untrusted certification claims cannot enable the endpoint', () => {
  assert.equal(check('key','key',{...valid, certified:true,user_id:'another-account',phone_confirmed_at:'2026-10-25'}).data.certified,false);
});
test('malformed body fails closed', () => {
  for (const body of [null,[],false,'bad']) assert.equal(check('key','key',body).status,400);
});
