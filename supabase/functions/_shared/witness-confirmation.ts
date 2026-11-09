export type Env={get(name:string):string|undefined};
const uuid=(x:unknown)=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x);
export const hashOtp=async(salt:string,otp:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+otp)))).map(x=>x.toString(16).padStart(2,'0')).join('');
function otp(){let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0]}while(n>=4294000000);return String(n%1000000).padStart(6,'0')}
export async function handleWitness(request:Request,env:Env,transport:typeof fetch=fetch,forcedAction?:string):Promise<Response>{
 const origin=request.headers.get('Origin');
 const allowed=['https://www.afroloc.ao','https://afroloc.ao','https://natal.yamilook.com'];
 const cors=origin&&allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'}:{};
 const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{...cors,'Cache-Control':'no-store'}});
 if(origin&&!allowed.includes(origin))return reply({error:'Origem não autorizada.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST')return reply({error:'Método não permitido.'},405);
 const bearer=request.headers.get('Authorization')||'';
 if(!/^Bearer [^\s]+$/.test(bearer)||bearer.length>8100)return reply({error:'Entre na sua conta AFROLOC.'},401);
 try{
  const base=env.get('SUPABASE_URL'),anon=env.get('SUPABASE_ANON_KEY'),service=env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!base||!anon||!service)return reply({error:'Serviço indisponível.'},503);
  const auth=await transport(base+'/auth/v1/user',{headers:{apikey:anon,Authorization:bearer},signal:AbortSignal.timeout(10000)});
  if(!auth.ok)return reply({error:'Volte a entrar na sua conta AFROLOC.'},401);
  const user=await auth.json();
  if(!user.id||user.is_anonymous)return reply({error:'É necessária uma conta AFROLOC identificada.'},401);
  if(user.factors?.some((f:any)=>f.status==='verified')){
   let claims;try{claims=JSON.parse(atob(bearer.slice(7).split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{}
   if(claims?.aal!=='aal2')return reply({error:'Conclua a autenticação adicional na AFROLOC.'},403);
  }
  const raw=await request.text();if(raw.length>4000)return reply({error:'Pedido demasiado grande.'},400);
  let p;try{p=JSON.parse(raw)}catch{return reply({error:'Pedido inválido.'},400)}
  const action=forcedAction||(p.action||'');
  if(!['request','send','info','verify'].includes(action))return reply({error:'Operação desconhecida.'},400);
  if(action==='request'&&(!uuid(p.record_id)||typeof p.code!=='string'||p.code.length>100||p.consent!==true))return reply({error:'Indique o endereço da testemunha e confirme o pedido.'},400);
  if(action!=='request'&&!uuid(p.witness_id))return reply({error:'Pedido de testemunho inválido.'},400);
  const headers={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
  const rpc=async(op:string,payload:unknown)=>{
   const r=await transport(base+'/rest/v1/rpc/witness_confirmation_v2',{method:'POST',headers,body:JSON.stringify({p_actor:user.id,p_action:op,p_payload:payload}),signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error('database');return await r.json();
  };
  const info=action==='request'?null:await rpc('info',{witness_id:p.witness_id});
  if(info&&!info.ok)return reply({error:info.error},403);
  if(action==='info')return reply(info);
  if(action==='verify'){
   if(!info.is_witness)return reply({error:'Só a testemunha pode confirmar este pedido.'},403);
   if(!/^\d{6}$/.test(p.otp_code||'')||typeof p.full_name!=='string'||p.full_name.trim().length<3||p.full_name.length>160||typeof p.signature!=='string'||p.signature.trim().length<3||p.signature.length>500||p.consent!==true||!['confirm','reject',undefined].includes(p.decision))return reply({error:'Preencha o código de seis algarismos, o nome, a assinatura e a declaração.'},400);
   const challengeResponse=await transport(base+'/rest/v1/afroloc_witness_challenges?select=salt,challenge_id&witness_id=eq.'+p.witness_id,{headers,signal:AbortSignal.timeout(8000)});
   if(!challengeResponse.ok)throw Error('challenge');
   const challenge=(await challengeResponse.json())[0];
   if(!challenge)return reply({error:'Peça um novo código de confirmação.'},400);
   const result=await rpc('verify',{witness_id:p.witness_id,challenge_id:challenge.challenge_id,otp_hash:await hashOtp(challenge.salt,p.otp_code),full_name:p.full_name,signature:p.signature,consent:true,decision:p.decision||'confirm'});
   return reply(result.ok?{success:true,...result}:{error:result.error},result.ok?200:400);
  }
  let witnessId=p.witness_id,registration;
  if(action==='request'){
   registration=await rpc('request',{record_id:p.record_id,code:p.code.trim(),consent:true});
   if(!registration.ok)return reply({error:registration.error},400);
   witnessId=registration.witness_id;
   if(registration.status!=='pending')return reply({...registration,notification_sent:false,message:'Este testemunho já foi concluído.'});
  }
  const baseSms=env.get('INFOBIP_BASE_URL'),key=env.get('INFOBIP_API_KEY');
  const notSent=(message:string)=>reply({ok:true,witness_id:witnessId,status:'pending',notification_sent:false,message});
  if(!baseSms||!key)return notSent('Pedido registado. O envio de SMS aguarda configuração do fornecedor.');
  let smsUrl;try{smsUrl=new URL(baseSms)}catch{return notSent('Pedido registado. A configuração do fornecedor de SMS precisa de revisão.')}
  if(smsUrl.protocol!=='https:'||!smsUrl.hostname.endsWith('.api.infobip.com'))return notSent('Pedido registado. A configuração do fornecedor de SMS precisa de revisão.');
  const code=otp(),salt=crypto.randomUUID();
  const challengePayload={witness_id:witnessId,otp_hash:await hashOtp(salt,code),salt};
  let challenge=await rpc('prepare',challengePayload);
  if(!challenge.ok&&challenge.reason==='phone_not_verified'){
   // Auth's private schema is not readable by service-role SQL. Use the supported
   // Admin API, only after the RPC has authorised this particular witness request.
   const rowResponse=await transport(base+'/rest/v1/afroloc_witnesses?select=witness_user_id&id=eq.'+witnessId,{headers,signal:AbortSignal.timeout(8000)});
   if(!rowResponse.ok)throw Error('witness');
   const row=(await rowResponse.json())[0];
   if(row?.witness_user_id){
    const authResponse=await transport(base+'/auth/v1/admin/users/'+encodeURIComponent(row.witness_user_id),{headers,signal:AbortSignal.timeout(8000)});
    const recipient=authResponse.ok?await authResponse.json():null;
    if(recipient?.phone_confirmed_at&&recipient?.phone&&!recipient.deleted_at){challenge=await rpc('prepare',{...challengePayload,auth_verified_phone:recipient.phone});}
   }
  }
  if(!challenge.ok)return notSent(challenge.error);
  let accepted=false;
  try{
   const sent=await transport(smsUrl.origin+'/sms/2/text/advanced',{method:'POST',headers:{Authorization:'App '+key,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({messages:[{from:env.get('INFOBIP_SENDER')||'AFROLOC',destinations:[{to:challenge.phone.slice(1)}],text:'AFROLOC: codigo '+code+' para confirmar o testemunho de residencia. Valido por 10 minutos. Nao partilhe. Entre na sua conta: https://www.afroloc.ao/confirm-witness/'+witnessId}]}),signal:AbortSignal.timeout(15000)});
   const data=await sent.json().catch(()=>null);const status=data?.messages?.[0]?.status;
   accepted=sent.ok&&!!data?.messages?.[0]?.messageId&&([1,3].includes(status?.groupId)||['PENDING','DELIVERED'].includes(status?.groupName));
  }catch{}
  const delivery=await rpc('delivery',{witness_id:witnessId,challenge_id:challenge.challenge_id,accepted});
  if(!accepted||!delivery.ok)return notSent('Pedido registado. O fornecedor não confirmou o envio do código; pode tentar novamente após um minuto.');
  return reply({ok:true,witness_id:witnessId,status:'pending',notification_sent:true,expires_at:challenge.expires_at,message:'O fornecedor aceitou o SMS. Só a testemunha pode confirmar na sua própria conta.'});
 }catch{return reply({error:'Não foi possível concluir a operação. Consulte o estado antes de tentar novamente.'},502)}
}
