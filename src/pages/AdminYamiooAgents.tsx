import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Users, Search, Loader2, Hash, Phone, Mail, ShieldCheck, ShieldOff, RefreshCw } from "lucide-react";

interface YamiooAgent {
  id: string;
  user_id: string;
  agent_number: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
}

export default function AdminYamiooAgents() {
  const [agents, setAgents] = useState<YamiooAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [searchPhone, setSearchPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [registering, setRegistering] = useState(false);
  const { toast } = useToast();

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await supabase.functions.invoke("manage-yamioo-agents", {
        method: "GET",
      });
      if (resp.error) throw resp.error;
      setAgents(resp.data?.agents || []);
    } catch (err) {
      console.error("Fetch agents error:", err);
      toast({ title: "Erro", description: "Falha ao carregar agentes.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleSearchUser = async () => {
    if (searchPhone.trim().length < 6) return;
    setSearching(true);
    try {
      const resp = await supabase.functions.invoke("lookup-requester", {
        body: { phone: searchPhone.trim() },
      });
      if (resp.error) throw resp.error;
      setSearchResults(resp.data?.results || []);
      if (!resp.data?.found) {
        toast({ title: "Não encontrado", description: "Nenhum utilizador com este número.", variant: "destructive" });
      }
    } catch (err) {
      console.error("Search error:", err);
      toast({ title: "Erro", description: "Falha na pesquisa.", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleRegister = async () => {
    if (!selectedUser) return;
    setRegistering(true);
    try {
      const resp = await supabase.functions.invoke("manage-yamioo-agents", {
        method: "POST",
        body: { user_id: selectedUser.user_id, notes: notes.trim() || null },
      });
      if (resp.error) throw resp.error;
      if (resp.data?.error) {
        toast({ title: "Erro", description: resp.data.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Agente registado!",
        description: resp.data?.reactivated
          ? `${selectedUser.full_name || "Utilizador"} foi reactivado como agente.`
          : `${selectedUser.full_name || "Utilizador"} registado como agente Yamioo #${resp.data?.agent_number}.`,
      });
      setRegisterOpen(false);
      resetForm();
      fetchAgents();
    } catch (err: any) {
      console.error("Register error:", err);
      toast({ title: "Erro", description: err?.message || "Falha ao registar agente.", variant: "destructive" });
    } finally {
      setRegistering(false);
    }
  };

  const handleDeactivate = async (agent: YamiooAgent) => {
    try {
      const resp = await supabase.functions.invoke("manage-yamioo-agents", {
        method: "DELETE",
        body: { agent_id: agent.id },
      });
      if (resp.error) throw resp.error;
      toast({ title: "Agente desactivado", description: `Agente #${agent.agent_number} foi desactivado.` });
      fetchAgents();
    } catch (err) {
      console.error("Deactivate error:", err);
      toast({ title: "Erro", description: "Falha ao desactivar agente.", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setSearchPhone("");
    setSearchResults([]);
    setSelectedUser(null);
    setNotes("");
  };

  const activeAgents = agents.filter(a => a.is_active);
  const inactiveAgents = agents.filter(a => !a.is_active);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Gestão de Agentes Yamioo
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Registe e gira os agentes autorizados a criar endereços em nome de solicitantes
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAgents} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Dialog open={registerOpen} onOpenChange={(o) => { setRegisterOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Registar Agente
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Registar Novo Agente Yamioo</DialogTitle>
                  <DialogDescription>
                    Pesquise o utilizador por telefone e atribua-lhe o papel de agente. O número de agente será atribuído automaticamente.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  {/* Search */}
                  <div className="space-y-2">
                    <Label>Telefone do utilizador</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="+244 9XX XXX XXX"
                        value={searchPhone}
                        onChange={(e) => setSearchPhone(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearchUser()}
                        className="font-mono"
                      />
                      <Button onClick={handleSearchUser} disabled={searching || searchPhone.trim().length < 6} size="sm">
                        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Results */}
                  {searchResults.length > 0 && !selectedUser && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{searchResults.length} resultado(s)</Label>
                      {searchResults.map((r: any) => (
                        <button
                          key={r.user_id}
                          onClick={() => setSelectedUser(r)}
                          className="w-full text-left p-3 rounded-lg border hover:border-primary hover:bg-accent/50 transition-colors"
                        >
                          <p className="font-medium text-sm">{r.full_name || "Sem nome"}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone || "—"}</span>
                            <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.email || "—"}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected user */}
                  {selectedUser && (
                    <Card className="border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm">{selectedUser.full_name || "Sem nome"}</p>
                            <p className="text-xs text-muted-foreground">{selectedUser.phone} · {selectedUser.email || "sem email"}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)} className="text-xs">
                            Alterar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Notes */}
                  {selectedUser && (
                    <div className="space-y-2">
                      <Label>Notas (opcional)</Label>
                      <Textarea
                        placeholder="Ex: Agente da zona do Cazenga, escritório principal..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                      />
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => { setRegisterOpen(false); resetForm(); }}>
                    Cancelar
                  </Button>
                  <Button onClick={handleRegister} disabled={!selectedUser || registering}>
                    {registering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                    Registar Agente
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{agents.length}</p>
                <p className="text-xs text-muted-foreground">Total de agentes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeAgents.length}</p>
                <p className="text-xs text-muted-foreground">Activos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <ShieldOff className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inactiveAgents.length}</p>
                <p className="text-xs text-muted-foreground">Inactivos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agents table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lista de Agentes</CardTitle>
            <CardDescription>Todos os agentes registados com número sequencial atribuído</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Nenhum agente registado</p>
                <p className="text-xs mt-1">Clique em "Registar Agente" para começar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead className="w-24">Acções</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id} className={!agent.is_active ? "opacity-50" : ""}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            <Hash className="h-3 w-3 mr-1" />
                            {agent.agent_number}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{agent.full_name || "—"}</TableCell>
                        <TableCell className="font-mono text-sm">{agent.phone || "—"}</TableCell>
                        <TableCell className="text-sm">{agent.email || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {[agent.city, agent.country].filter(Boolean).join(", ") || "—"}
                        </TableCell>
                        <TableCell>
                          {agent.is_active ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-300">Activo</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-destructive">Inactivo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {agent.notes || "—"}
                        </TableCell>
                        <TableCell>
                          {agent.is_active && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                  <ShieldOff className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Desactivar agente #{agent.agent_number}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {agent.full_name || "Este utilizador"} perderá o papel de agente Yamioo e não poderá criar endereços em nome de terceiros. Esta acção pode ser revertida.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeactivate(agent)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Desactivar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
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
