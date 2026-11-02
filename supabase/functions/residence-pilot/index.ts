import {actor,admin,body,failure,json,preflight,rpc} from '../_shared/account-link.ts';
import {sendPilotInvitation} from './sms.ts';
import {handlePilotAction} from './handler.ts';
Deno.serve(async req => {
 const early=preflight(req); if(early)return early;
 try {
  const user=await actor(req);
  if(Deno.env.get('RESIDENCE_PILOT_ENABLED')!=='true')return json({ok:false,reason:'pilot_closed'},503);
  const input=await body(req),client=admin();
  return json(await handlePilotAction(user,input,{
   smsReady:Deno.env.get('RESIDENCE_PILOT_SMS_ENABLED')==='true'&&!!Deno.env.get('PILOT_PUBLIC_ORIGIN')&&!!Deno.env.get('INFOBIP_API_KEY')&&!!Deno.env.get('INFOBIP_BASE_URL'),
   call:(user,action,id,data)=>rpc(client,'residence_pilot_action',{p_actor:user,p_action:action,p_id:id,p_data:data}),
   send:sendPilotInvitation,
  }));
 } catch(error) {return failure(error);}
});
