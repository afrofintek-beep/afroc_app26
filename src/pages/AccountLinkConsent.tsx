import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AccountPhoneConfirmation from '@/components/account-link/AccountPhoneConfirmation';
export default function AccountLinkConsent(){
 const { user } = useAuth();
 const [links,setLinks]=useState<{id:string;code:string;revoked_at:string|null}[]>([]);
 const [id,setId]=useState(()=>new URLSearchParams(window.location.hash.slice(1)).get('request')??'');
 const [details,setDetails]=useState<{code:string;account_reference:string;recipient:string}|null>(null),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const run=async(action:string)=>{
  setBusy(true);setMessage('');
  try{
   const {data,error}=await supabase.functions.invoke('account-link-authority',{body:{action,id,code:details?.code,consent}});
   if(error||!data?.ok){setDetails(null);setConsent(false);setMessage(data?.reason==='phone_required'?'Confirma primeiro o telefone nesta conta AFROLOC.':'Pedido indisponível, expirado ou sem certificado válido para esta conta.');return;}
   if(action==='list_user'){setLinks(data.links);}
   else if(action==='inspect'){setDetails(data);setConsent(false);}else{setDetails(null);setConsent(false);setMessage(action==='approve'?'Autorização registada. Volta à KOSOLOLA/Yamilook para concluir a ligação.':'Ligação revogada.');}
  }catch{setMessage('Não foi possível concluir. Tenta mais tarde.');}finally{setBusy(false);}
 };
 if(import.meta.env.VITE_ACCOUNT_LINK_V1_ENABLED!=='true')return <main className="p-6"><h1>Ligação entre contas em validação</h1><p>Continua a usar o AFROLOC normalmente.</p></main>;
 if(!user)return <main className="max-w-lg mx-auto p-5 space-y-4"><h1>Entra no AFROLOC para rever o pedido</h1><p>O pedido fica aberto nesta página. Depois de entrares, volta aqui.</p><Button asChild><a href="/login" target="_blank" rel="noopener noreferrer">Entrar no AFROLOC</a></Button><Button variant="outline" onClick={()=>window.location.reload()}>Já entrei — continuar</Button></main>;
 return <main className="max-w-lg mx-auto p-5 space-y-4"><h1 className="text-xl font-bold">Autorizar ligação de conta</h1><AccountPhoneConfirmation/>
  <p>Entra na tua conta AFROLOC habitual. Não partilhes palavras-passe nem códigos SMS com a outra aplicação.</p>
  <label className="block">Identificador do pedido<Input value={id} disabled={busy} onChange={e=>{setId(e.target.value);setDetails(null);setConsent(false);}}/></label>
  <Button disabled={busy||!id} onClick={()=>void run('inspect')}>Rever pedido</Button>
  {details&&<section className="rounded-xl border p-4 space-y-3"><p>Destinatário: <strong>{details.recipient}</strong></p><p>Referência da conta: <strong>{details.account_reference}</strong></p><p className="break-all">Endereço: {details.code}</p>
   <p>Só aproves se começaste este pedido na tua conta KOSOLOLA/Yamilook e a referência coincide. As contas não serão fundidas.</p>
   <label className="flex gap-2"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>Autorizo a consulta da titularidade e validade do certificado deste endereço por esta conta, até 90 dias ou até o certificado expirar. Posso revogar a ligação.</label>
   <Button disabled={busy||!consent} onClick={()=>void run('approve')}>Autorizar ligação</Button></section>}
  <Button variant="outline" disabled={busy||!id} onClick={()=>void run('revoke_user')}>Revogar ligação deste pedido</Button>
  <Button variant="outline" disabled={busy} onClick={()=>void run('list_user')}>Ver as minhas ligações</Button>
  {links.map(link=><div key={link.id} className="border-t py-2"><p className="break-all">{link.code} — {link.revoked_at?'Revogada':'Autorizada'}</p>{!link.revoked_at&&<Button variant="outline" onClick={()=>{setId(link.id);setDetails(null);setConsent(false);setMessage('Ligação selecionada. Usa o botão Revogar ligação deste pedido.');}}>Selecionar para revogar</Button>}</div>)}
  <p role="status">{message}</p>
 </main>;
}
