import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, UserCheck, Loader2, Trash2, MapPin } from "lucide-react";

interface Division { code: string; name: string; }
interface Validator { user_id: string; email: string; full_name: string | null; jurisdiction: string | null; assigned_at: string | null; }

export default function AdminAddressValidators() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [prov, setProv] = useState<Division | null>(null);
  const [mun, setMun] = useState<Division | null>(null);

  const { data: provinces } = useQuery({
    queryKey: ["div-l1"],
    queryFn: async () => {
      const { data } = await supabase.from("administrative_divisions")
        .select("code, name").eq("country_code", "AO").eq("level", 1).order("name");
      return (data ?? []) as Division[];
    },
  });

  const { data: municipios } = useQuery({
    queryKey: ["div-l2", prov?.code],
    enabled: !!prov?.code,
    queryFn: async () => {
      const { data } = await supabase.from("administrative_divisions")
        .select("code, name").eq("country_code", "AO").eq("level", 2).eq("parent_code", prov!.code).order("name");
      return (data ?? []) as Division[];
    },
  });

  const { data: validators, isLoading } = useQuery({
    queryKey: ["address-validators"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_address_validators");
      if (error) throw error;
      return (data ?? []) as Validator[];
    },
  });

  const assign = useMutation({
    mutationFn: async () => {
      const name = fullName.trim() || `Validador — ${mun?.name ?? prov?.name ?? ""}`;
      const { data, error } = await supabase.functions.invoke("create-staff", {
        body: {
          email: email.trim().toLowerCase(),
          fullName: name,
          role: "operator_field",
          jurisdiction: {
            country: "AO",
            l1_code: prov?.code ?? null, l1_name: prov?.name ?? null,
            l2_code: mun?.code ?? null, l2_name: mun?.name ?? null,
          },
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as { ok: boolean; invited: boolean; email: string };
    },
    onSuccess: (res) => {
      toast.success(
        res.invited
          ? `Validador criado. Convite para definir a palavra-passe enviado para ${res.email}.`
          : `Conta ${res.email} já existia — agora é validador nesta jurisdição.`,
      );
      setEmail(""); setFullName(""); setProv(null); setMun(null);
      qc.invalidateQueries({ queryKey: ["address-validators"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("revoke_address_validator", { p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Validador removido"); qc.invalidateQueries({ queryKey: ["address-validators"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><UserCheck className="h-6 w-6 text-primary" /> Validadores de endereços</h1>
            <p className="text-sm text-muted-foreground">Agentes de terreno que registam e validam endereços na sua jurisdição.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Criar validador</CardTitle>
            <CardDescription>
              Cria a conta e envia um convite por email para a pessoa definir a palavra-passe. Não passa pelo registo de cidadão.
              Se o email já tiver conta, apenas fica com o papel de validador nesta jurisdição.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="name">Nome (ou função)</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex.: Validador — Talatona" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="validador.talatona@afroloc.com" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Província</Label>
                <Select value={prov?.code ?? ""} onValueChange={(v) => { setProv(provinces?.find((p) => p.code === v) ?? null); setMun(null); }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar província" /></SelectTrigger>
                  <SelectContent>{(provinces ?? []).map((p) => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Município (opcional)</Label>
                <Select value={mun?.code ?? ""} onValueChange={(v) => setMun(municipios?.find((m) => m.code === v) ?? null)} disabled={!prov}>
                  <SelectTrigger><SelectValue placeholder={prov ? "Toda a província" : "Escolhe a província primeiro"} /></SelectTrigger>
                  <SelectContent>{(municipios ?? []).map((m) => <SelectItem key={m.code} value={m.code}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={() => assign.mutate()} disabled={assign.isPending || !email.trim() || !prov}>
              {assign.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserCheck className="h-4 w-4 mr-2" />}
              Criar e convidar validador
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Validadores atuais {validators ? `(${validators.length})` : ""}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !validators || validators.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Ainda não há validadores nomeados.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Jurisdição</TableHead><TableHead className="text-right">Ações</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {validators.map((v) => (
                      <TableRow key={v.user_id}>
                        <TableCell className="font-medium">{v.full_name || "—"}</TableCell>
                        <TableCell>{v.email}</TableCell>
                        <TableCell><span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{v.jurisdiction || "—"}</span></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="text-destructive border-destructive/30"
                            onClick={() => { if (window.confirm(`Remover ${v.email} como validador?`)) revoke.mutate(v.user_id); }}
                            disabled={revoke.isPending}>
                            <Trash2 className="h-4 w-4 mr-1" /> Remover
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
