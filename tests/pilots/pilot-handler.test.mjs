import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handlePilotAction} from '../../supabase/functions/residence-pilot/handler.ts';
const user='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
function ports(){const calls=[],sends=[];return {calls,sends,smsReady:true,call:async(...args)=>{calls.push(args);return {ok:true,phone:'+244923456789',invitation_id:id}},send:async(...args)=>{sends.push(args);return {accepted:true,reference:'fake-provider'}}};}
test('no caller or missing SMS config produces no database reservation or SMS',async()=>{
 for(const [actor,ready] of [['',true],[user,false]]){const p=ports();p.smsReady=ready;assert.equal((await handlePilotAction(actor,{action:'invite',id},p)).ok,false);assert.equal(p.calls.length,0);assert.equal(p.sends.length,0);}
});
test('browser cannot forge internal send_result or pass malformed data',async()=>{
 for(const input of [{action:'send_result',id},{action:'invite',id:'bad'},{action:'list',data:[]}]){const p=ports();assert.equal((await handlePilotAction(user,input,p)).ok,false);assert.equal(p.calls.length,0);}
});
test('actor is server-provided, SMS is sent only after reservation, phone never returned',async()=>{
 const p=ports();const result=await handlePilotAction(user,{action:'invite',id,actor:'forged',data:{phone:'+244900000000'}},p);
 assert.equal(p.calls[0][0],user);assert.equal(p.sends[0][0],'+244923456789');assert.equal(p.calls[1][1],'send_result');assert.equal(result.reason,'sms_accepted');assert.equal(result.phone,undefined);
});
test('denied reservation sends nothing; provider failure persists without reporting delivery',async()=>{
 const p=ports();p.call=async()=>({ok:false,reason:'try_later'});assert.equal((await handlePilotAction(user,{action:'invite',id},p)).ok,false);assert.equal(p.sends.length,0);
 const q=ports();q.send=async()=>({accepted:false});assert.equal((await handlePilotAction(user,{action:'invite',id},q)).reason,'sms_failed');assert.equal(q.calls[1][3].accepted,false);
});
