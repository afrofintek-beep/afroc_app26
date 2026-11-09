import {useEffect,useState} from 'react';
import {useParams,useNavigate} from 'react-router-dom';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {supabase} from '@/integrations/supabase/client';
import afrolocSymbol from '@/assets/afroloc-symbol.png';

type Info={is_witness:boolean;status:string;afroloc_code:string;municipality:string;zone:string;street:string;number:string;unit:string;temporary:boolean;expires_at:string};
export default function ConfirmWitness(){
 const {witnessId}=useParams<{witnessId:string}>(),navigate=useNavigate();
 const [info,setInfo]=useState<Info|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('A consultar o pedido…'),[needsLogin,setNeedsLogin]=useState(false);
 const [otp,setOtp]=useState(''),[fullName,setFullName]=useState(''),[signature,setSignature]=useState(''),[consent,setConsent]=useState(false),[decision,setDecision]=useState('confirm');
 async function call(action:string,extra:Record<string,unknown>={}){
  const {data,error}=await supabase.functions.invoke('witness-confirmation',{body:{action,witness_id:witnessId,...extra}});
  if(error){const details=await error.context?.json?.().catch(()=>null);throw Error(details?.error||'Não foi possível concluir. Volte a entrar na AFROLOC se a sessão terminou.');}
  if(data?.error)throw Error(data.error);return data;
 }
 useEffect(()=>{let active=true;(async()=>{try{const {data:{user}}=await supabase.auth.getUser();if(!user){if(active){setNeedsLogin(true);setMessage('Entre na sua conta AFROLOC e volte a abrir esta ligação.');}return;}const data=await call('info');if(active){setInfo(data);setMessage('');}}catch(e){if(active)setMessage(e instanceof Error?e.message:'Pedido indisponível.');}})();return()=>{active=false;};},[witnessId]);
 async function resend(){if(busy)return;setBusy(true);try{const data=await call('send');setMessage(data.message);}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível enviar o código.');}finally{setBusy(false)}}
 async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);try{const data=await call('verify',{otp_code:otp,full_name:fullName,signature,consent,decision});setInfo(old=>old?{...old,status:data.status}:old);setOtp('');setMessage(data.status==='confirmed'?'Testemunho confirmado na AFROLOC.':'Ficou registado que não confirmou esta residência.');}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível concluir a confirmação.');}finally{setBusy(false)}}
 return <main className="min-h-screen flex items-center justify-center bg-background p-4"><Card className="w-full max-w-lg"><CardHeader className="text-center"><img src={afrolocSymbol} alt="AFROLOC" className="mx-auto h-14 w-14 rounded-xl"/><CardTitle>Confirmar testemunho</CardTitle></CardHeader><CardContent className="space-y-5">
  <p role="status" aria-live="polite">{message}</p>
  {needsLogin&&<Button onClick={()=>navigate('/login')}>Entrar na AFROLOC</Button>}
  {info&&<><div className="rounded-lg border p-4 space-y-2"><strong className="break-all">{info.afroloc_code}</strong><p>{[info.street,info.number,info.unit,info.zone,info.municipality].filter(Boolean).join(' · ')}</p><p>Estado: {info.status==='confirmed'?'Confirmado':info.status==='rejected'?'Não confirmado':'Pendente'}</p></div>
  {!info.is_witness?<p>Este pedido deve ser confirmado exclusivamente pela conta da testemunha indicada.</p>:info.status==='pending'?<form onSubmit={submit} className="space-y-4">
   <p>Confirme apenas se conhece pessoalmente a residência indicada. Não partilhe o código recebido.</p>
   <Label htmlFor="otp">Código recebido por SMS</Label><Input id="otp" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={e=>setOtp(e.target.value)} pattern="[0-9]{6}" maxLength={6} required/>
   <Button type="button" variant="outline" disabled={busy} onClick={resend}>Pedir novo código</Button>
   <Label htmlFor="name">Nome completo</Label><Input id="name" value={fullName} onChange={e=>setFullName(e.target.value)} minLength={3} maxLength={160} required/>
   <Label htmlFor="signature">Assinatura — escreva o seu nome</Label><Input id="signature" value={signature} onChange={e=>setSignature(e.target.value)} minLength={3} maxLength={500} required/>
   <Label htmlFor="decision">A pessoa reside nesta morada?</Label><select id="decision" className="w-full rounded-md border p-3 bg-background" value={decision} onChange={e=>setDecision(e.target.value)}><option value="confirm">Sim, confirmo a residência</option><option value="reject">Não confirmo a residência</option></select>
   <label className="flex gap-3 items-start text-sm"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>Declaro que esta é a minha decisão e autorizo o registo do meu testemunho para este endereço.</span></label>
   <Button className="w-full" type="submit" disabled={busy}>{busy?'A guardar…':'Registar a minha decisão'}</Button>
  </form>:<Button onClick={()=>navigate('/identities')}>Os meus endereços</Button>}
  <p className="text-sm text-muted-foreground">Esta confirmação não constitui certificação pelas autoridades. {info.temporary?'O endereço permanece temporário e sujeito à finalidade e ao prazo definidos.':''}</p></>}
 </CardContent></Card></main>;
}
