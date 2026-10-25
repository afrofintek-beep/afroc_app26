import {actor,admin,body,failure,json,preflight,rpc,secretMatches,uuid} from '../_shared/account-link.ts';
Deno.serve(async req=>{
 const early=preflight(req);if(early)return early;
 try {
  const input=await body(req);const partner=['begin','exchange','status','revoke_partner'].includes(input.action);
  let user:string|null=null;
  if(partner) {if(!await secretMatches(req.headers.get('x-account-link-key'),Deno.env.get('ACCOUNT_LINK_PARTNER_KEY')))throw new Error('unauthorized');}
  else user=await actor(req);
  if(Deno.env.get('ACCOUNT_LINK_V1_ENABLED')!=='true')return json({ok:false,reason:'integration_pending'},503);
  if(!partner&&!['list_user','inspect','approve','revoke_user','issue','revoke_certificate'].includes(input.action))return json({ok:false,reason:'invalid_request'},400);
  if(!['begin','list_user'].includes(input.action)&&!uuid(input.id))return json({ok:false,reason:'invalid_request'},400);
  if(partner&&!uuid(input.subject))return json({ok:false,reason:'invalid_request'},400);
  return json(await rpc(admin(),'partner_link_action',{p_action:input.action,p_actor:user,p_id:input.id??null,p_subject:partner?input.subject:null,p_code:input.code??null,p_hash:partner?input.verifier_hash??null:null,p_consent:input.consent===true,p_expiry:input.action==='issue'?input.expires_at??null:null}));
 }catch(error){return failure(error);}
});
