/** Authenticated orchestration. The caller is obtained with getUser(), never request JSON. */
type Input={action?:unknown;id?:unknown;data?:unknown};
type Result=Record<string,unknown>;
type Ports={
 smsReady:boolean;
 call:(actor:string,action:string,id:string|null,data:Record<string,unknown>)=>Promise<Result>;
 send:(phone:string,id:string)=>Promise<{accepted:boolean;reference?:string}>;
};
const actions=new Set(['list','create','invite','declare','withdraw_declaration','withdraw','issue','reject','revoke','configure','person','revoke_person']);
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function handlePilotAction(user:string,input:Input,ports:Ports):Promise<Result>{
 if(!uuid(user))return {ok:false,reason:'unauthorized'};
 if(typeof input.action!=='string'||!actions.has(input.action)||(!['list','configure'].includes(input.action)&&!uuid(input.id)))return {ok:false,reason:'invalid_request'};
 if(input.data!==undefined&&(!input.data||typeof input.data!=='object'||Array.isArray(input.data)))return {ok:false,reason:'invalid_request'};
 if(input.action==='invite'&&!ports.smsReady)return {ok:false,reason:'sms_unconfigured'};
 const result=await ports.call(user,input.action,uuid(input.id)?input.id:null,(input.data??{}) as Record<string,unknown>);
 if(input.action!=='invite'||result.ok!==true)return result;
 if(typeof result.phone!=='string'||!/^\+244[0-9]{9}$/.test(result.phone)||!uuid(result.invitation_id))throw new Error('unavailable');
 const delivery=await ports.send(result.phone,result.invitation_id);
 await ports.call(user,'send_result',result.invitation_id,{accepted:delivery.accepted,reference:delivery.reference});
 return {ok:delivery.accepted,reason:delivery.accepted?'sms_accepted':'sms_failed',invitation_id:result.invitation_id};
}
