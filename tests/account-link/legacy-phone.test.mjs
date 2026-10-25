import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../../supabase/functions/phone-login/handler.ts';
test('legacy codes and forged development origins never create a session',async()=>{
 for(const origin of ['http://localhost','https://preview.example','https://www.afroloc.ao']) {
  const r=handler(new Request('https://example.test',{method:'POST',headers:{origin},body:JSON.stringify({phone:'+244900000000',otp_code:'123456',verified:true})}));
  assert.equal(r.status,410);const b=await r.json();assert.equal(b.success,false);assert.equal(b.reason,'legacy_phone_login_retired');assert.equal(b.access_token,undefined);assert.equal(b.refresh_token,undefined);
 }
});
test('malformed payload does not trigger side effects and preflight remains available',async()=>{
 assert.equal(handler(new Request('https://example.test',{method:'POST',body:'{'})).status,410);
 assert.equal(handler(new Request('https://example.test',{method:'OPTIONS'})).status,204);
 assert.equal(handler(new Request('https://example.test')).status,405);
});
