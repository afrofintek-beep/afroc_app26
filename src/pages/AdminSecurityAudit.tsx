import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { pt, enUS } from "date-fns/locale";
import { 
  Shield, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  User, 
  Globe,
  FileText,
  Activity,
  Filter,
  Download,
  Eye
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  function_name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  endpoint: string | null;
  details: any;
  notes: string | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

const AdminSecurityAudit = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const dateLocale = language === "pt" ? pt : enUS;

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [resolvedFilter, setResolvedFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | SecurityEvent | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("audit");

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some(r => r.role === "admin");
    if (!isAdmin) {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem aceder esta página.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    await loadData();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Load audit logs
      const { data: auditData, error: auditError } = await supabase
        .from("security_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (auditError) throw auditError;
      setAuditLogs(auditData || []);

      // Load security events
      const { data: eventsData, error: eventsError } = await supabase
        .from("security_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (eventsError) throw eventsError;
      setSecurityEvents(eventsData || []);
    } catch (error) {
      console.error("Error loading audit data:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os logs de auditoria.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return <Badge variant="destructive" className="bg-red-600">Crítico</Badge>;
      case "high":
        return <Badge variant="destructive">Alto</Badge>;
      case "medium":
        return <Badge className="bg-yellow-600">Médio</Badge>;
      case "low":
        return <Badge variant="secondary">Baixo</Badge>;
      case "info":
        return <Badge variant="outline">Info</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getActionBadge = (action: string) => {
    if (action.includes("delete") || action.includes("remove")) {
      return <Badge variant="destructive">{action}</Badge>;
    }
    if (action.includes("create") || action.includes("insert")) {
      return <Badge className="bg-green-600">{action}</Badge>;
    }
    if (action.includes("update") || action.includes("change")) {
      return <Badge className="bg-blue-600">{action}</Badge>;
    }
    if (action.includes("login") || action.includes("auth")) {
      return <Badge className="bg-purple-600">{action}</Badge>;
    }
    return <Badge variant="secondary">{action}</Badge>;
  };

  const filteredAuditLogs = auditLogs.filter(log => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        log.action?.toLowerCase().includes(search) ||
        log.function_name?.toLowerCase().includes(search) ||
        log.user_id?.toLowerCase().includes(search) ||
        log.ip_address?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const filteredSecurityEvents = securityEvents.filter(event => {
    let matches = true;
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      matches = matches && (
        event.event_type?.toLowerCase().includes(search) ||
        event.user_id?.toLowerCase().includes(search) ||
        event.ip_address?.toLowerCase().includes(search) ||
        event.endpoint?.toLowerCase().includes(search)
      );
    }
    
    if (severityFilter !== "all") {
      matches = matches && event.severity?.toLowerCase() === severityFilter;
    }
    
    if (resolvedFilter !== "all") {
      matches = matches && (resolvedFilter === "resolved" ? event.resolved : !event.resolved);
    }
    
    return matches;
  });

  const handleViewDetails = (log: AuditLog | SecurityEvent) => {
    setSelectedLog(log);
    setDetailsDialogOpen(true);
  };

  const exportToCSV = () => {
    const data = activeTab === "audit" ? filteredAuditLogs : filteredSecurityEvents;
    const headers = activeTab === "audit" 
      ? ["ID", "User ID", "Action", "Function", "IP Address", "Created At"]
      : ["ID", "Event Type", "Severity", "User ID", "IP Address", "Resolved", "Created At"];
    
    const csvContent = [
      headers.join(","),
      ...data.map(row => {
        if (activeTab === "audit") {
          const r = row as AuditLog;
          return [r.id, r.user_id || "", r.action, r.function_name, r.ip_address || "", r.created_at].join(",");
        } else {
          const r = row as SecurityEvent;
          return [r.id, r.event_type, r.severity, r.user_id || "", r.ip_address || "", r.resolved, r.created_at].join(",");
        }
      })
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `security_${activeTab}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const stats = {
    totalAuditLogs: auditLogs.length,
    totalEvents: securityEvents.length,
    unresolvedEvents: securityEvents.filter(e => !e.resolved).length,
    criticalEvents: securityEvents.filter(e => e.severity === "critical" || e.severity === "high").length,
    recentActivity: auditLogs.filter(l => {
      const created = new Date(l.created_at);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return created > hourAgo;
    }).length
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Logs de Auditoria de Segurança
            </h1>
            <p className="text-muted-foreground">
              Visualize e analise todos os eventos de segurança e logs de auditoria do sistema
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Logs de Auditoria</p>
                  <p className="text-2xl font-bold">{stats.totalAuditLogs}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Eventos de Segurança</p>
                  <p className="text-2xl font-bold">{stats.totalEvents}</p>
                </div>
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Não Resolvidos</p>
                  <p className="text-2xl font-bold text-yellow-500">{stats.unresolvedEvents}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Críticos/Alto</p>
                  <p className="text-2xl font-bold text-red-500">{stats.criticalEvents}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Última Hora</p>
                  <p className="text-2xl font-bold text-green-500">{stats.recentActivity}</p>
                </div>
                <Activity className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar por ação, usuário, IP..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Severidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="critical">Crítico</SelectItem>
                  <SelectItem value="high">Alto</SelectItem>
                  <SelectItem value="medium">Médio</SelectItem>
                  <SelectItem value="low">Baixo</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
              <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="unresolved">Não Resolvidos</SelectItem>
                  <SelectItem value="resolved">Resolvidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Logs de Auditoria ({filteredAuditLogs.length})
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Eventos de Segurança ({filteredSecurityEvents.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Logs de Auditoria</CardTitle>
                <CardDescription>
                  Registro de todas as ações administrativas e mudanças no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Ação</TableHead>
                          <TableHead>Função</TableHead>
                          <TableHead>User ID</TableHead>
                          <TableHead>IP</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAuditLogs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              Nenhum log de auditoria encontrado
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredAuditLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="whitespace-nowrap">
                                {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: dateLocale })}
                              </TableCell>
                              <TableCell>{getActionBadge(log.action)}</TableCell>
                              <TableCell className="font-mono text-sm">{log.function_name}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {log.user_id ? `${log.user_id.slice(0, 8)}...` : "-"}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {log.ip_address || "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewDetails(log)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Eventos de Segurança</CardTitle>
                <CardDescription>
                  Eventos de segurança detectados pelo sistema (tentativas de acesso, erros, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Severidade</TableHead>
                          <TableHead>User ID</TableHead>
                          <TableHead>IP</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSecurityEvents.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                              Nenhum evento de segurança encontrado
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredSecurityEvents.map((event) => (
                            <TableRow key={event.id}>
                              <TableCell className="whitespace-nowrap">
                                {format(new Date(event.created_at), "dd/MM/yyyy HH:mm:ss", { locale: dateLocale })}
                              </TableCell>
                              <TableCell className="font-medium">{event.event_type}</TableCell>
                              <TableCell>{getSeverityBadge(event.severity)}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {event.user_id ? `${event.user_id.slice(0, 8)}...` : "-"}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {event.ip_address || "-"}
                              </TableCell>
                              <TableCell>
                                {event.resolved ? (
                                  <Badge variant="outline" className="text-green-500 border-green-500">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Resolvido
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Pendente
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewDetails(event)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Detalhes do Registro
              </DialogTitle>
              <DialogDescription>
                Informações completas do log selecionado
              </DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">ID</p>
                    <p className="font-mono text-xs break-all">{selectedLog.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data/Hora</p>
                    <p>{format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: dateLocale })}</p>
                  </div>
                  {"action" in selectedLog && (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Ação</p>
                        <p>{getActionBadge(selectedLog.action)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Função</p>
                        <p className="font-mono text-sm">{selectedLog.function_name}</p>
                      </div>
                    </>
                  )}
                  {"event_type" in selectedLog && (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Tipo de Evento</p>
                        <p>{selectedLog.event_type}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Severidade</p>
                        {getSeverityBadge(selectedLog.severity)}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Endpoint</p>
                        <p className="font-mono text-sm">{selectedLog.endpoint || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <p>{selectedLog.resolved ? "Resolvido" : "Pendente"}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">User ID</p>
                    <p className="font-mono text-xs break-all">{selectedLog.user_id || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">IP Address</p>
                    <p className="font-mono">{selectedLog.ip_address || "-"}</p>
                  </div>
                </div>
                
                {selectedLog.user_agent && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">User Agent</p>
                    <p className="font-mono text-xs break-all bg-muted p-2 rounded">{selectedLog.user_agent}</p>
                  </div>
                )}

                {"notes" in selectedLog && selectedLog.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Notas</p>
                    <p className="bg-muted p-2 rounded">{selectedLog.notes}</p>
                  </div>
                )}
                
                {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Detalhes (JSON)</p>
                    <pre className="font-mono text-xs bg-muted p-3 rounded overflow-x-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminSecurityAudit;
