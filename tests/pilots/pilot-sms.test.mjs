import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {sendPilotInvitation} from '../../supabase/functions/residence-pilot/sms.ts';
const originalFetch=globalThis.fetch,originalDeno=globalThis.Deno;
const config={PILOT_PUBLIC_ORIGIN:'https://pilot.example',INFOBIP_BASE_URL:'https://sms.example',INFOBIP_API_KEY:'TEST-NOT-A-REAL-KEY',INFOBIP_SENDER:'AFROLOC'};
function setup(overrides={}){globalThis.Deno={env:{get:name=>({...config,...overrides})[name]}};}
afterEach(()=>{globalThis.fetch=originalFetch;globalThis.Deno=originalDeno;});
test('SMS contains account-bound invitation link, no resident name or address; accepted is not delivered',async()=>{
 setup();let called=0;globalThis.fetch=async(url,options)=>{
  called++;assert.equal(String(url),'https://sms.example/sms/3/messages');
  const {messages:[m]}=JSON.parse(options.body);assert.equal(m.destinations[0].to,'244923456789');
  assert.match(m.content.text,/https:\/\/pilot.example\/piloto\/lar-do-patriota#convite=invite-test/);assert.equal(m.sender,'AFROLOC');
  return Response.json({messages:[{messageId:'provider-id',status:{groupName:'PENDING'}}]});
 };
 assert.deepEqual(await sendPilotInvitation('+244923456789','invite-test'),{accepted:true,reference:'provider-id'});assert.equal(called,1);
});
for(const group of ['REJECTED','UNDELIVERABLE','EXPIRED',undefined])test(`provider ${group} is not success even with HTTP 200`,async()=>{
 setup();globalThis.fetch=async()=>Response.json({messages:[{messageId:'provider-id',status:{groupName:group}}]});
 assert.equal((await sendPilotInvitation('+244923456789','invite-test')).accepted,false);
});
test('HTTP failure, network timeout and malformed response all fail closed',async()=>{
 setup();for(const fake of [async()=>new Response('',{status:403}),async()=>{throw new Error('timeout')},async()=>new Response('bad json')]){
  globalThis.fetch=fake;assert.equal((await sendPilotInvitation('+244923456789','invite-test')).accepted,false);
 }
});
test('insecure origin cannot send an invitation',async()=>{
 setup({PILOT_PUBLIC_ORIGIN:'http://pilot.example'});globalThis.fetch=()=>{throw new Error('must not send')};
 assert.equal((await sendPilotInvitation('+244923456789','invite-test')).accepted,false);
});
