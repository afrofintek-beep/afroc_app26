import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";

// Ativação de uma morada registada no terreno por um agente, em nome de um
// potencial utilizador. A pessoa (já com conta) identifica-se pelo código do
// endereço + o telefone que deu ao agente, recebe um OTP por SMS e confirma.
// Se for o titular, a posse do endereço transita da autoridade para ela.
export default function ResidentActivation() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [residentId, setResidentId] = useState<string | null>(null);
  const [isPrimary, setIsPrimary] = useState(false);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (!code.trim() || !phone.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("resident_start_activation" as never, {
        p_afroloc_code: code.trim(), p_phone: phone.trim(),
      } as never);
      if (error) throw error;
      const r = data as unknown as { ok?: boolean; reason?: string; resident_id?: string; is_primary?: boolean };
      if (!r?.ok) {
        toast.error(
          r?.reason === "endereco_nao_encontrado" ? "Endereço não encontrado. Confirma o código."
          : r?.reason === "residente_nao_encontrado" ? "Não encontrámos um registo com este telefone neste endereço. Confirma o número que deste ao agente."
          : r?.reason === "telefone_em_falta" ? "Indica o teu telefone."
          : "Não foi possível iniciar a ativação."
        );
        return;
      }
      setResidentId(r.resident_id!);
      setIsPrimary(!!r.is_primary);
      setStep(2);
      toast.success("Enviámos um código por SMS ao teu telefone. Insere-o abaixo.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!residentId || !otp.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("resident_confirm_activation" as never, {
        p_resident_id: residentId, p_otp: otp.trim(),
      } as never);
      if (error) throw error;
      const r = data as unknown as { ok?: boolean; reason?: string; is_primary?: boolean };
      if (!r?.ok) {
        toast.error(
          r?.reason === "otp_invalido" ? "Código errado. Tenta de novo."
          : r?.reason === "otp_expirado" ? "O código expirou. Pede um novo."
          : r?.reason === "tentativas_excedidas" ? "Demasiadas tentativas. Pede um novo código."
          : r?.reason === "ja_ativado" ? "Este registo já foi ativado."
          : "Não foi possível confirmar."
        );
        return;
      }
      toast.success(r.is_primary ? "Ativado! Este endereço é agora teu." : "Ativado! Já constas como residente.");
      navigate("/dashboard");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-md mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-primary" /> Ativar a minha morada
          </h1>
          <p className="text-sm text-muted-foreground">
            Foi um agente que registou a tua morada no terreno? Ativa-a aqui com o teu telefone.
          </p>
        </div>

        {step === 1 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1 · Identificar</CardTitle>
              <CardDescription>Indica o código AFROLOC e o telefone que deste ao agente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="c">Código AFROLOC</Label>
                <Input id="c" value={code} onChange={(e) => setCode(e.target.value)} placeholder="AO-LDA-…" className="font-mono" />
              </div>
              <div>
                <Label htmlFor="p">Telefone</Label>
                <Input id="p" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+244 9xx xxx xxx" />
              </div>
              <Button onClick={start} disabled={busy || !code.trim() || !phone.trim()} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Receber código
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2 · Confirmar</CardTitle>
              <CardDescription>Insere o código de 6 dígitos que recebeste por SMS.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="o">Código (OTP)</Label>
                <Input id="o" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="000000" maxLength={6}
                  className="font-mono text-center text-lg tracking-widest" />
              </div>
              <Button onClick={confirm} disabled={busy || otp.trim().length < 4} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                {isPrimary ? "Ativar e assumir a morada" : "Ativar"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="w-full">Voltar</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
