import assert from 'node:assert/strict';
import {handleWitness,hashOtp} from '../../supabase/functions/_shared/witness-confirmation.ts';
const id='12345678-1234-1234-1234-123456789000',userId='owner';
let calls=[],isWitness=false,smsConfigured=true,providerAccepted=true,authValid=true,prepared=true,delivered=false,actualOtp='',fallbackNeeded=false,authPhoneVerified=true;
const env={get:k=>({SUPABASE_URL:'https://test.invalid',SUPABASE_ANON_KEY:'public-test',SUPABASE_SERVICE_ROLE_KEY:'server-test',INFOBIP_BASE_URL:smsConfigured?'https://test.api.infobip.com':undefined,INFOBIP_API_KEY:smsConfigured?'sms-test':undefined})[k]};
const transport=async(url,options)=>{calls.push({url,options});
 if(url.endsWith('/auth/v1/user'))return Response.json({id:userId},{status:authValid?200:401});
 if(url.includes('/afroloc_witnesses?'))return Response.json([{witness_user_id:'witness'}]);
 if(url.includes('/auth/v1/admin/users/'))return Response.json({phone:'244900000002',phone_confirmed_at:authPhoneVerified?'now':null});
 if(url.includes('/sms/2/')){actualOtp=JSON.parse(options.body).messages[0].text.match(/codigo (\d{6})/)[1];return Response.json({messages:[{messageId:'message',status:{groupName:providerAccepted?'PENDING':'REJECTED',groupId:providerAccepted?1:5}}]});}
 if(url.includes('/afroloc_witness_challenges?'))return Response.json([{salt:'test-salt',challenge_id:id}]);
 const p=JSON.parse(options.body);if(p.p_action==='info')return Response.json({ok:true,is_witness:isWitness,status:'pending'});
 if(p.p_action==='request')return Response.json({ok:true,witness_id:id,status:'pending'});
 if(p.p_action==='prepare'&&fallbackNeeded&&!p.p_payload.auth_verified_phone)return Response.json({ok:false,reason:'phone_not_verified',error:'Telefone por confirmar.'});
 if(p.p_action==='prepare')return Response.json(prepared?{ok:true,phone:'+244900000000',challenge_id:id,expires_at:'later'}:{ok:false,error:'Aguarde antes de pedir outro código.'});
 if(p.p_action==='delivery'){delivered=p.p_payload.accepted;return Response.json({ok:true})}
 if(p.p_action==='verify'){assert.equal(p.p_payload.otp_hash,await hashOtp('test-salt','123456'));return Response.json({ok:true,status:'confirmed'})}
 throw Error('unexpected');
};
const req=(p,auth='Bearer test')=>new Request('https://test.invalid',{method:'POST',headers:{Authorization:auth},body:JSON.stringify(p)});
const run=p=>handleWitness(req(p),env,transport);
assert.equal((await handleWitness(req({},''),env,transport)).status,401);assert.equal(calls.length,0);
authValid=false;assert.equal((await run({action:'info',witness_id:id})).status,401);authValid=true;
let response=await run({action:'verify',witness_id:id,otp_code:'123456',full_name:'Test Name',signature:'Test Name',consent:true});assert.equal(response.status,403);assert.ok(!calls.some(c=>c.url.includes('challenges?')));
isWitness=true;response=await run({action:'verify',witness_id:id,otp_code:'123456',full_name:'Test Name',signature:'Test Name',consent:false});assert.equal(response.status,400);
response=await run({action:'verify',witness_id:id,otp_code:'123456',full_name:'Test Name',signature:'Test Name',consent:true});assert.equal(response.status,200);
calls=[];smsConfigured=false;let body=await(await run({action:'request',record_id:id,code:'CODE',consent:true})).json();assert.equal(body.notification_sent,false);assert.ok(!calls.some(c=>c.url.includes('/sms/')));
smsConfigured=true;providerAccepted=false;body=await(await run({action:'send',witness_id:id})).json();assert.equal(body.notification_sent,false);assert.equal(delivered,false);
providerAccepted=true;body=await(await run({action:'send',witness_id:id})).json();assert.equal(body.notification_sent,true);assert.equal(delivered,true);assert.ok(!JSON.stringify(body).includes(actualOtp));assert.ok(!JSON.stringify(body).includes('+244900000000'));assert.ok(!JSON.stringify(body).includes('otp_hash'));
fallbackNeeded=true;calls=[];body=await(await run({action:'send',witness_id:id})).json();assert.equal(body.notification_sent,true);assert.ok(calls.some(c=>c.url.includes('/auth/v1/admin/users/')));authPhoneVerified=false;calls=[];body=await(await run({action:'send',witness_id:id})).json();assert.equal(body.notification_sent,false);assert.ok(!calls.some(c=>c.url.includes('/sms/')));fallbackNeeded=false;
prepared=false;calls=[];body=await(await run({action:'send',witness_id:id})).json();assert.equal(body.notification_sent,false);assert.ok(!calls.some(c=>c.url.includes('/sms/')));
console.log('PASS: authentication, witness ownership before challenge access, explicit declaration, private OTP/phone, provider rejection, absent provider and rate-limit fail closed; accepted SMS remains pending until verification.');
