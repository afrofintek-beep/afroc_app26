// Dedicated adapter: provider acceptance is not delivery and is never residence evidence.
// No phone, message, credentials, or provider response bodies are logged.
export async function sendPilotInvitation(phone:string,id:string) {
 try {
  const origin=new URL(Deno.env.get('PILOT_PUBLIC_ORIGIN')!);
  const provider=new URL(Deno.env.get('INFOBIP_BASE_URL')!);
  if(origin.protocol!=='https:'||provider.protocol!=='https:')throw new Error('configuration');
  const link=new URL('/piloto/lar-do-patriota',origin.origin);link.hash=new URLSearchParams({convite:id}).toString();
  const response=await fetch(new URL('/sms/3/messages',provider.origin),{
   method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:`App ${Deno.env.get('INFOBIP_API_KEY')}`,'Content-Type':'application/json'},
   body:JSON.stringify({messages:[{sender:Deno.env.get('INFOBIP_SENDER')||'AFROLOC',destinations:[{to:phone.slice(1)}],content:{text:`AFROLOC Lar do Patriota: convite para declarar o que sabe sobre uma residencia. Entre na sua conta e reveja: ${link}. Expira em 72h. Nao partilhe codigos.`}}]})
  });
  if(!response.ok)return {accepted:false};
  const payload=await response.json();const message=payload?.messages?.[0];
  return {accepted:!!message?.messageId&&['PENDING','DELIVERED'].includes(message?.status?.groupName),reference:typeof message?.messageId==='string'?message.messageId:undefined};
 } catch {return {accepted:false};}
}
