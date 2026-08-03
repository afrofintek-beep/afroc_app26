import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, MapPin, Loader2, CheckCircle2, UserPlus, XCircle } from "lucide-react";

export default function ValidateAddress() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [jurisdiction, setJurisdiction] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  type PendingRow = {
    id: string; code: string;
    level1_name: string | null; level2_name: string | null; level3_name: string | null;
    property_type: string | null;
    potential_user_name: string | null; potential_user_phone: string | null;
    occupancy_title: string | null; created_at: string;
  };
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      const [{ data: roles }, { data: lvl }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("user_authorization_levels")
          .select("administrative_role, jurisdiction_country, jurisdiction_level1_name, jurisdiction_level2_name")
          .eq("user_id", user.id).maybeSingle(),
      ]);
      const admin = (roles ?? []).some((r: { role: string }) =>
        ["admin", "admin_national", "admin_province", "admin_municipality"].includes(r.role));
      const validator = (roles ?? []).some((r: { role: string }) => r.role === "operator_field");
      setIsAdmin(admin);
      setAllowed(admin || validator);
      const l = lvl as { jurisdiction_level2_name?: string; jurisdiction_level1_name?: string; jurisdiction_country?: string } | null;
      setJurisdiction(admin ? "Todo o país" : (l?.jurisdiction_level2_name || l?.jurisdiction_level1_name || l?.jurisdiction_country || "—"));
      setReady(true);
      if (admin || validator) loadPending();
    })();
  }, [navigate]);

  // Pendentes de validação na jurisdição (fiscalização/acompanhamento).
  const loadPending = async () => {
    setLoadingPending(true);
    try {
      const { data, error } = await supabase.rpc("list_pending_captures" as never);
      if (!error && data) setPending(data as unknown as PendingRow[]);
    } finally {
      setLoadingPending(false);
    }
  };

  const certify = async (targetCode?: string) => {
    const c = (targetCode ?? code).trim();
    if (!c) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("validator_certify_address", {
        p_code: c, p_note: "Validação de campo (validador de endereços)",
      });
      if (error) throw error;
      const res = data as { found: boolean; allowed?: boolean; reason?: string; code?: string };
      if (!res?.found) { toast.error("Endereço não encontrado. Confirma o código."); return; }
      if (res.allowed === false) {
        const msg = res.reason === "fora_da_jurisdicao" ? "Este endereço está fora da tua jurisdição."
          : res.reason === "fora_do_pais" ? "Este endereço está fora do teu país."
          : res.reason === "sem_jurisdicao" ? "Ainda não tens jurisdição atribuída. Fala com um admin."
          : "Não autorizado para este endereço.";
        toast.error(msg);
        return;
      }
      toast.success(`Endereço ${res.code} certificado. Já é válido e serve de testemunha.`);
      if (!targetCode) setCode("");
      loadPending();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao certificar");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return <DashboardLayout><div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></DashboardLayout>;
  }

  if (!allowed) {
    return (
      <DashboardLayout>
        <Card className="max-w-md mx-auto mt-10">
          <CardContent className="py-10 text-center space-y-2">
            <XCircle className="h-10 w-10 mx-auto text-destructive" />
            <p className="font-medium">Sem permissão</p>
            <p className="text-sm text-muted-foreground">Esta área é para validadores de endereços. Fala com um administrador para seres nomeado.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" /> Validar endereço</h1>
          <p className="text-sm text-muted-foreground">Regista e valida endereços AFROLOC de forma célere, sem testemunhas.</p>
        </div>

        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span className="text-sm">A tua jurisdição</span></div>
            <Badge variant="secondary">{jurisdiction}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Certificar por código</CardTitle>
            <CardDescription>Indica o código AFROLOC do endereço a validar. Fica certificado (nível 4) pela tua autoridade.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="c">Código AFROLOC</Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input id="c" value={code} onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && code.trim()) certify(); }}
                placeholder="AO-LDA-TAL-KTA-KTA-G10-359Z-N24Z4" className="font-mono flex-1" />
              <Button onClick={certify} disabled={busy || !code.trim()}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Certificar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Pendentes na tua jurisdição
              {pending.length > 0 && <Badge variant="secondary">{pending.length}</Badge>}
            </CardTitle>
            <CardDescription>Endereços registados em nome de potenciais utilizadores, a aguardar a tua validação (fiscalização).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingPending ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhum endereço pendente na tua jurisdição.</p>
            ) : (
              pending.map((p) => (
                <div key={p.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.potential_user_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{p.potential_user_phone || "sem telefone"}</p>
                      <p className="font-mono text-xs mt-1 break-all">{p.code}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {[p.level3_name, p.level2_name].filter(Boolean).join(" · ")}
                        {p.occupancy_title
                          ? ` · ${p.occupancy_title === "owner" ? "Proprietário" : p.occupancy_title === "tenant" ? "Arrendatário" : p.occupancy_title}`
                          : ""}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => certify(p.code)} disabled={busy}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Validar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium">Registar um novo endereço</p>
              <p className="text-sm text-muted-foreground">Cria o endereço e depois certifica-o aqui pelo código.</p>
            </div>
            <Button variant="outline" onClick={() => navigate("/identities/create")}>
              <UserPlus className="h-4 w-4 mr-2" /> Registar
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
