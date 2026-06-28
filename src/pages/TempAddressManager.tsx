import { useState, useEffect } from "react";
import { Search, Timer, CheckCircle2, XCircle, RefreshCw, Loader2, MapPin, Calendar, User } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AfrolocRecord = Database["public"]["Tables"]["afroloc_records"]["Row"] & {
  is_temporary?: boolean;
  temporary_expires_at?: string | null;
  temporary_granted_by?: string | null;
  temporary_validity_days?: number | null;
};

export default function TempAddressManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<AfrolocRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expired" | "suspended">("all");

  // Grant dialog state
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantCode, setGrantCode] = useState("");
  const [grantDays, setGrantDays] = useState("30");
  const [granting, setGranting] = useState(false);

  // Reactivate dialog
  const [reactivateRecord, setReactivateRecord] = useState<AfrolocRecord | null>(null);
  const [reactivateDays, setReactivateDays] = useState("30");
  const [reactivating, setReactivating] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    // Use raw query since is_temporary isn't in generated types yet
    const { data } = await supabase
      .from("afroloc_records")
      .select("*")
      .filter("is_temporary", "eq", true)
      .order("created_at", { ascending: false });

    setRecords((data as AfrolocRecord[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleGrant = async () => {
    if (!grantCode.trim() || !user) return;
    setGranting(true);

    // Find the record by code
    const { data: rec, error: findErr } = await supabase
      .from("afroloc_records")
      .select("id")
      .eq("code", grantCode.trim().toUpperCase())
      .maybeSingle();

    if (findErr || !rec) {
      toast({ title: "Erro", description: "Código AFROLOC não encontrado.", variant: "destructive" });
      setGranting(false);
      return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(grantDays));

    const { error } = await supabase
      .from("afroloc_records")
      .update({
        is_temporary: true,
        temporary_expires_at: expiresAt.toISOString(),
        temporary_granted_by: user.id,
        temporary_validity_days: parseInt(grantDays),
        status: "approved" as any,
      })
      .eq("id", rec.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: `Código temporário atribuído (${grantDays} dias).` });
      setGrantOpen(false);
      setGrantCode("");
      fetchRecords();
    }
    setGranting(false);
  };

  const handleReactivate = async () => {
    if (!reactivateRecord || !user) return;
    setReactivating(true);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(reactivateDays));

    const { error } = await supabase
      .from("afroloc_records")
      .update({
        temporary_expires_at: expiresAt.toISOString(),
        temporary_validity_days: parseInt(reactivateDays),
        temporary_granted_by: user.id,
        status: "approved" as any,
      })
      .eq("id", reactivateRecord.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Reativado", description: `Endereço reativado por ${reactivateDays} dias.` });
      setReactivateRecord(null);
      fetchRecords();
    }
    setReactivating(false);
  };

  const handleSuspend = async (record: AfrolocRecord) => {
    const { error } = await supabase
      .from("afroloc_records")
      .update({ status: "suspended" as any })
      .eq("id", record.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Suspenso", description: "Endereço temporário suspenso." });
      fetchRecords();
    }
  };

  const getDaysRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = !search || r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.level1_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.level2_name?.toLowerCase().includes(search.toLowerCase());

    const days = getDaysRemaining(r.temporary_expires_at);
    const isExpired = days !== null && days <= 0;
    const isSuspended = (r.status as string) === "suspended";

    if (filter === "active") return matchesSearch && !isExpired && !isSuspended;
    if (filter === "expired") return matchesSearch && isExpired;
    if (filter === "suspended") return matchesSearch && isSuspended;
    return matchesSearch;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Gestão de Endereços Temporários</h1>
            <p className="text-sm text-muted-foreground">Atribuir, suspender e reativar códigos AFROLOC temporários</p>
          </div>
          <Button onClick={() => setGrantOpen(true)}>
            <Timer className="h-4 w-4 mr-2" />
            Atribuir temporário
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por código ou localização..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="expired">Expirados</SelectItem>
              <SelectItem value="suspended">Suspensos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold">{records.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-chart-2">
                {records.filter(r => {
                  const d = getDaysRemaining(r.temporary_expires_at);
                  return d !== null && d > 0 && (r.status as string) !== "suspended";
                }).length}
              </p>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-destructive">
                {records.filter(r => {
                  const d = getDaysRemaining(r.temporary_expires_at);
                  return d !== null && d <= 0;
                }).length}
              </p>
              <p className="text-xs text-muted-foreground">Expirados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-amber-500">
                {records.filter(r => (r.status as string) === "suspended").length}
              </p>
              <p className="text-xs text-muted-foreground">Suspensos</p>
            </CardContent>
          </Card>
        </div>

        {/* Records list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum endereço temporário encontrado.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((r) => {
              const days = getDaysRemaining(r.temporary_expires_at);
              const isExpired = days !== null && days <= 0;
              const isSuspended = (r.status as string) === "suspended";

              return (
                <Card key={r.id} className={isExpired ? "border-destructive/30" : isSuspended ? "border-amber-400/30 opacity-60" : ""}>
                  <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-mono font-bold text-sm">{r.code}</p>
                          {isExpired ? (
                            <Badge variant="destructive" className="text-[10px]">EXPIRADO</Badge>
                          ) : isSuspended ? (
                            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">SUSPENSO</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">
                              <Timer className="h-2.5 w-2.5 mr-0.5" />
                              {days}d restantes
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {[r.level1_name, r.level2_name, r.level4_name].filter(Boolean).join(", ")}
                          </span>
                          {r.temporary_expires_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Expira: {new Date(r.temporary_expires_at).toLocaleDateString("pt")}
                            </span>
                          )}
                          {r.temporary_validity_days && (
                            <span>{r.temporary_validity_days} dias</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {(isExpired || isSuspended) && (
                          <Button size="sm" variant="outline" onClick={() => { setReactivateRecord(r); setReactivateDays("30"); }}>
                            <RefreshCw className="h-3.5 w-3.5 mr-1" />
                            Reativar
                          </Button>
                        )}
                        {!isExpired && !isSuspended && (
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleSuspend(r)}>
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Suspender
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Grant dialog */}
        <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Atribuir código temporário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Código AFROLOC</Label>
                <Input
                  placeholder="AO-LUA-G10-X1A2-Y3B4"
                  value={grantCode}
                  onChange={(e) => setGrantCode(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <Label>Validade</Label>
                <Select value={grantDays} onValueChange={setGrantDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGrantOpen(false)}>Cancelar</Button>
              <Button onClick={handleGrant} disabled={granting || !grantCode.trim()}>
                {granting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Timer className="h-4 w-4 mr-2" />}
                Atribuir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reactivate dialog */}
        <Dialog open={!!reactivateRecord} onOpenChange={(open) => !open && setReactivateRecord(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reativar endereço temporário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm">
                Código: <span className="font-mono font-bold">{reactivateRecord?.code}</span>
              </p>
              <div>
                <Label>Nova validade</Label>
                <Select value={reactivateDays} onValueChange={setReactivateDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReactivateRecord(null)}>Cancelar</Button>
              <Button onClick={handleReactivate} disabled={reactivating}>
                {reactivating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Reativar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
