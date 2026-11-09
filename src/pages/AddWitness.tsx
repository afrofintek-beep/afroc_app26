import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft } from 'lucide-react';

export default function AddWitness(){
 const {id}=useParams<{id:string}>();const navigate=useNavigate();
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setMessage('');
  try{
   const {data,error}=await supabase.functions.invoke('witness-confirmation',{body:{action:'request',record_id:id,code:code.trim(),consent:true}});
   if(error){const details=await error.context?.json?.().catch(()=>null);throw Error(details?.error||'Entre na sua conta AFROLOC e tente novamente.');}
   if(!data?.ok)throw Error(data?.error||'Não foi possível registar o pedido.');
   setMessage(data.message||'Pedido registado. A confirmação continua pendente.');
  }catch(e){setMessage(e instanceof Error?e.message:'Não foi possível concluir o pedido.');}finally{setBusy(false)}
 }
 return <DashboardLayout><div className="max-w-2xl mx-auto space-y-6">
  <Button variant="ghost" onClick={()=>navigate(`/identity/${id}`)}><ArrowLeft className="mr-2 h-4 w-4"/>Voltar ao endereço</Button>
  <Card><CardHeader><CardTitle>Adicionar testemunha</CardTitle></CardHeader><CardContent className="space-y-5">
   <p>Indique até três vizinhos distintos. Cada testemunha deve ter a sua própria morada AFROLOC validada e residir até 100 metros do endereço.</p>
   <p>O código é enviado por SMS ao número confirmado da própria testemunha. A confirmação exige entrada na conta AFROLOC dessa pessoa, o código recebido e a sua declaração. O titular não pode confirmar em nome da testemunha.</p>
   <form onSubmit={submit} className="space-y-4"><Label htmlFor="witness-code">Endereço AFROLOC da testemunha</Label><Input id="witness-code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={100} required autoComplete="off"/>
    <Button type="submit" disabled={busy||!code.trim()}>{busy?'A registar…':'Registar e enviar pedido à testemunha'}</Button>
   </form><p role="status" aria-live="polite" className="text-sm">{message}</p>
   <p className="text-sm text-muted-foreground">A confirmação comunitária não substitui a validação das autoridades competentes. Endereços temporários da feira mantêm a finalidade e o prazo definidos.</p>
  </CardContent></Card>
 </div></DashboardLayout>;
}
