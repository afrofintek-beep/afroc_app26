import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, ArrowLeft, Loader2, UserCheck } from "lucide-react";

interface PendingUser {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  purpose: string[] | null;
  created_at: string | null;
  approval_requested_at: string | null;
}

export default function AdminUserApprovals() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<PendingUser | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Flag da fase experimental (liga/desliga o gate para novos registos).
  const { data: gateOn } = useQuery({
    queryKey: ["approval-gate-flag"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "experimental_approval_required")
        .maybeSingle();
      return (data?.value as boolean | null) === true;
    },
  });

  const toggleGate = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from("app_settings")
        .update({ value: next, updated_at: new Date().toISOString() })
        .eq("key", "experimental_approval_required");
      if (error) throw error;
    },
    onSuccess: (_d, next) => {
      queryClient.invalidateQueries({ queryKey: ["approval-gate-flag"] });
      toast.success(next ? "Aprovação manual LIGADA" : "Aprovação manual DESLIGADA (novos registos entram diretamente)");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Utilizadores pendentes (admins têm SELECT em profiles via RLS).
  const { data: pending, isLoading } = useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, country, city, purpose, created_at, approval_requested_at")
        .eq("approval_status", "pending")
        .order("approval_requested_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PendingUser[];
    },
  });

  const decide = useMutation({
    mutationFn: async (args: { userId: string; status: "approved" | "rejected"; reason?: string }) => {
      const { error } = await supabase.rpc("set_user_approval", {
        p_user_id: args.userId,
        p_status: args.status,
        p_reason: args.reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, args) => {
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      toast.success(args.status === "approved" ? "Utilizador aprovado" : "Utilizador recusado");
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserCheck className="h-6 w-6 text-primary" />
              Aprovação de utilizadores
            </h1>
            <p className="text-sm text-muted-foreground">Fase experimental — aprove ou recuse os novos registos.</p>
          </div>
        </div>

        {/* Toggle da fase experimental */}
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium">Exigir aprovação manual dos novos registos</p>
              <p className="text-sm text-muted-foreground">
                Quando desligado, os novos utilizadores entram diretamente (fim da fase experimental).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={gateOn ? "default" : "secondary"}>{gateOn ? "Ligado" : "Desligado"}</Badge>
              <Switch checked={!!gateOn} onCheckedChange={(v) => toggleGate.mutate(v)} disabled={toggleGate.isPending} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" /> Pendentes {pending ? `(${pending.length})` : ""}
            </CardTitle>
            <CardDescription>Registos concluídos a aguardar decisão.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !pending || pending.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
                Nenhum utilizador a aguardar aprovação.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Pedido em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                        <TableCell>{u.phone || "—"}</TableCell>
                        <TableCell>{[u.city, u.country].filter(Boolean).join(", ") || "—"}</TableCell>
                        <TableCell>
                          {u.approval_requested_at
                            ? new Date(u.approval_requested_at).toLocaleDateString()
                            : u.created_at
                              ? new Date(u.created_at).toLocaleDateString()
                              : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              onClick={() => decide.mutate({ userId: u.user_id, status: "approved" })}
                              disabled={decide.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setRejectTarget(u)}
                              disabled={decide.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Recusar
                            </Button>
                          </div>
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

      {/* Diálogo de recusa */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar utilizador</DialogTitle>
            <DialogDescription>
              {rejectTarget?.full_name ? `A recusar ${rejectTarget.full_name}. ` : ""}
              Podes indicar um motivo (opcional), que será mostrado ao utilizador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo</Label>
            <Textarea
              id="reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex.: dados incompletos; fora da área da fase experimental…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={decide.isPending}
              onClick={() =>
                rejectTarget &&
                decide.mutate({ userId: rejectTarget.user_id, status: "rejected", reason: rejectReason.trim() || undefined })
              }
            >
              {decide.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Recusar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
