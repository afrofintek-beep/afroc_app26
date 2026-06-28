import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { 
  AlertTriangle, 
  Search, 
  CheckCircle2, 
  XCircle,
  Eye,
  Filter,
  Users,
  MapPin,
  Clock,
  Shield,
  BarChart3,
  Download,
  FileSpreadsheet,
  Mail,
  Send
} from "lucide-react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { pt, enUS } from "date-fns/locale";
import { FraudMetricsDashboard } from "@/components/FraudMetricsDashboard";

interface FraudFlag {
  id: string;
  witness_user_id: string;
  afroloc_record_id: string | null;
  flag_type: string;
  severity: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  resolution_notes: string | null;
  created_at: string;
  witness_profile?: {
    full_name: string | null;
    phone: string | null;
  };
  afroloc_record?: {
    code: string;
    level1_name: string | null;
    level2_name: string | null;
  };
  resolver_profile?: {
    full_name: string | null;
  };
}

interface FraudStats {
  total: number;
  active: number;
  resolved: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export default function AdminFraudFlags() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [flags, setFlags] = useState<FraudFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedFlag, setSelectedFlag] = useState<FraudFlag | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolving, setResolving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [stats, setStats] = useState<FraudStats>({
    total: 0,
    active: 0,
    resolved: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  });

  const dateLocale = language === "pt" ? pt : enUS;

  useEffect(() => {
    checkAdminAccess();
    fetchFlags();
  }, []);

  const checkAdminAccess = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roles) {
      toast({
        title: t("access_denied"),
        description: t("admin_only_access"),
        variant: "destructive"
      });
      navigate("/identities");
    }
  };

  const fetchFlags = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("witness_fraud_flags")
        .select(`
          *,
          afroloc_record:afroloc_records(code, level1_name, level2_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch witness and resolver profiles separately
      const flagsWithProfiles = await Promise.all(
        (data || []).map(async (flag) => {
          const { data: witnessData } = await supabase
            .from("profiles")
            .select("full_name, phone")
            .eq("user_id", flag.witness_user_id)
            .single();

          let resolverData = null;
          if (flag.resolved_by_user_id) {
            const { data: resolver } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("user_id", flag.resolved_by_user_id)
              .single();
            resolverData = resolver;
          }

          return { 
            ...flag, 
            witness_profile: witnessData,
            resolver_profile: resolverData 
          };
        })
      );

      setFlags(flagsWithProfiles as FraudFlag[]);
      calculateStats(flagsWithProfiles as FraudFlag[]);
    } catch (error) {
      console.error("Error fetching fraud flags:", error);
      toast({
        title: t("error"),
        description: t("error_loading_data"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (flagData: FraudFlag[]) => {
    const stats: FraudStats = {
      total: flagData.length,
      active: flagData.filter(f => !f.resolved).length,
      resolved: flagData.filter(f => f.resolved).length,
      critical: flagData.filter(f => f.severity === "critical" && !f.resolved).length,
      high: flagData.filter(f => f.severity === "high" && !f.resolved).length,
      medium: flagData.filter(f => f.severity === "medium" && !f.resolved).length,
      low: flagData.filter(f => f.severity === "low" && !f.resolved).length
    };
    setStats(stats);
  };

  const handleResolve = async () => {
    if (!selectedFlag || !user) return;

    setResolving(true);
    try {
      const { error } = await supabase
        .from("witness_fraud_flags")
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by_user_id: user.id,
          resolution_notes: resolutionNotes
        })
        .eq("id", selectedFlag.id);

      if (error) throw error;

      toast({
        title: t("success"),
        description: t("fraud_flag_resolved")
      });

      setResolveDialogOpen(false);
      setResolutionNotes("");
      setSelectedFlag(null);
      fetchFlags();
    } catch (error) {
      console.error("Error resolving flag:", error);
      toast({
        title: t("error"),
        description: t("error_resolving_flag"),
        variant: "destructive"
      });
    } finally {
      setResolving(false);
    }
  };

  const sendFraudAlertEmail = async (flag: FraudFlag) => {
    setSendingEmail(flag.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-fraud-alert-email", {
        body: {
          flag_id: flag.id,
          witness_user_id: flag.witness_user_id,
          flag_type: flag.flag_type,
          severity: flag.severity,
          description: flag.description || `Flag de fraude: ${flag.flag_type}`,
          afroloc_code: flag.afroloc_record?.code,
          region_name: flag.afroloc_record?.level1_name
        }
      });

      if (error) throw error;

      toast({
        title: t("success"),
        description: t("fraud_alert_email_sent")
      });
    } catch (error) {
      console.error("Error sending fraud alert email:", error);
      toast({
        title: t("error"),
        description: t("error_sending_email"),
        variant: "destructive"
      });
    } finally {
      setSendingEmail(null);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
      critical: "destructive",
      high: "destructive",
      medium: "default",
      low: "secondary"
    };
    const colors: Record<string, string> = {
      critical: "bg-red-600",
      high: "bg-orange-500",
      medium: "bg-yellow-500",
      low: "bg-blue-500"
    };
    return (
      <Badge variant={variants[severity] || "default"} className={colors[severity]}>
        {t(`severity_${severity}`) || severity}
      </Badge>
    );
  };

  const getFlagTypeBadge = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      rapid_confirmations: <Clock className="h-3 w-3" />,
      cross_region: <MapPin className="h-3 w-3" />,
      collusion: <Users className="h-3 w-3" />
    };
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        {icons[type]}
        {t(`fraud_type_${type}`) || type}
      </Badge>
    );
  };

  const prepareExportData = () => {
    return filteredFlags.map(flag => ({
      [t("witness")]: flag.witness_profile?.full_name || t("unknown"),
      [t("phone")]: flag.witness_profile?.phone || "-",
      [t("type")]: t(`fraud_type_${flag.flag_type}`) || flag.flag_type,
      [t("severity")]: t(`severity_${flag.severity}`) || flag.severity,
      [t("afroloc_code")]: flag.afroloc_record?.code || "-",
      [t("region")]: flag.afroloc_record?.level1_name || "-",
      [t("description")]: flag.description || "-",
      [t("status")]: flag.resolved ? t("resolved") : t("active"),
      [t("created_at")]: format(new Date(flag.created_at), "dd/MM/yyyy HH:mm", { locale: dateLocale }),
      [t("resolved_by")]: flag.resolver_profile?.full_name || "-",
      [t("resolved_at")]: flag.resolved_at ? format(new Date(flag.resolved_at), "dd/MM/yyyy HH:mm", { locale: dateLocale }) : "-",
      [t("resolution_notes")]: flag.resolution_notes || "-"
    }));
  };

  const exportToCSV = () => {
    const data = prepareExportData();
    if (data.length === 0) {
      toast({
        title: t("error"),
        description: t("no_data_to_export"),
        variant: "destructive"
      });
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fraud-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: t("success"),
      description: t("export_csv_success")
    });
  };

  const exportToExcel = () => {
    const data = prepareExportData();
    if (data.length === 0) {
      toast({
        title: t("error"),
        description: t("no_data_to_export"),
        variant: "destructive"
      });
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t("fraud_flags"));
    
    // Auto-size columns
    const maxWidth = 50;
    const colWidths = Object.keys(data[0]).map(key => ({
      wch: Math.min(maxWidth, Math.max(key.length, ...data.map(row => String(row[key] || "").length)))
    }));
    worksheet["!cols"] = colWidths;

    XLSX.writeFile(workbook, `fraud-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`);

    toast({
      title: t("success"),
      description: t("export_excel_success")
    });
  };

  const filteredFlags = flags.filter(flag => {
    const matchesSearch = 
      flag.witness_profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.witness_profile?.phone?.includes(searchTerm) ||
      flag.afroloc_record?.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = severityFilter === "all" || flag.severity === severityFilter;
    const matchesType = typeFilter === "all" || flag.flag_type === typeFilter;

    return matchesSearch && matchesSeverity && matchesType;
  });

  const activeFlags = filteredFlags.filter(f => !f.resolved);
  const resolvedFlags = filteredFlags.filter(f => f.resolved);

  const renderFlagTable = (flagList: FraudFlag[], showResolution: boolean = false) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("witness")}</TableHead>
          <TableHead>{t("type")}</TableHead>
          <TableHead>{t("severity")}</TableHead>
          <TableHead>{t("afroloc_code")}</TableHead>
          <TableHead>{t("date")}</TableHead>
          {showResolution && <TableHead>{t("resolved_by")}</TableHead>}
          <TableHead className="text-right">{t("actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {flagList.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showResolution ? 7 : 6} className="text-center text-muted-foreground py-8">
              {t("no_fraud_flags_found")}
            </TableCell>
          </TableRow>
        ) : (
          flagList.map((flag) => (
            <TableRow key={flag.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{flag.witness_profile?.full_name || t("unknown")}</p>
                  <p className="text-sm text-muted-foreground">{flag.witness_profile?.phone}</p>
                </div>
              </TableCell>
              <TableCell>{getFlagTypeBadge(flag.flag_type)}</TableCell>
              <TableCell>{getSeverityBadge(flag.severity)}</TableCell>
              <TableCell>
                {flag.afroloc_record ? (
                  <div>
                    <p className="font-mono text-sm">{flag.afroloc_record.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {flag.afroloc_record.level1_name}
                    </p>
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                {format(new Date(flag.created_at), "dd/MM/yyyy HH:mm", { locale: dateLocale })}
              </TableCell>
              {showResolution && (
                <TableCell>
                  <div>
                    <p className="text-sm">{flag.resolver_profile?.full_name || "-"}</p>
                    {flag.resolved_at && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(flag.resolved_at), "dd/MM/yyyy", { locale: dateLocale })}
                      </p>
                    )}
                  </div>
                </TableCell>
              )}
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFlag(flag)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {!flag.resolved && (
                    <>
                      {(flag.severity === 'critical' || flag.severity === 'high') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendFraudAlertEmail(flag)}
                          disabled={sendingEmail === flag.id}
                          title={t("send_email_alert")}
                        >
                          {sendingEmail === flag.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setSelectedFlag(flag);
                          setResolveDialogOpen(true);
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              {t("fraud_flags_management")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t("fraud_flags_management_description")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToCSV} disabled={loading || filteredFlags.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              {t("export_csv")}
            </Button>
            <Button variant="outline" onClick={exportToExcel} disabled={loading || filteredFlags.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {t("export_excel")}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">{t("total")}</p>
            </CardContent>
          </Card>
          <Card className="border-orange-500/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-500">{stats.active}</div>
              <p className="text-xs text-muted-foreground">{t("active_flags")}</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-500">{stats.resolved}</div>
              <p className="text-xs text-muted-foreground">{t("resolved")}</p>
            </CardContent>
          </Card>
          <Card className="border-red-600/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
              <p className="text-xs text-muted-foreground">{t("severity_critical")}</p>
            </CardContent>
          </Card>
          <Card className="border-orange-500/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-500">{stats.high}</div>
              <p className="text-xs text-muted-foreground">{t("severity_high")}</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-500/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-500">{stats.medium}</div>
              <p className="text-xs text-muted-foreground">{t("severity_medium")}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-500">{stats.low}</div>
              <p className="text-xs text-muted-foreground">{t("severity_low")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("search_fraud_flags")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder={t("severity")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all_severities")}</SelectItem>
                    <SelectItem value="critical">{t("severity_critical")}</SelectItem>
                    <SelectItem value="high">{t("severity_high")}</SelectItem>
                    <SelectItem value="medium">{t("severity_medium")}</SelectItem>
                    <SelectItem value="low">{t("severity_low")}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder={t("flag_type")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all_types")}</SelectItem>
                    <SelectItem value="rapid_confirmations">{t("fraud_type_rapid_confirmations")}</SelectItem>
                    <SelectItem value="cross_region">{t("fraud_type_cross_region")}</SelectItem>
                    <SelectItem value="collusion">{t("fraud_type_collusion")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="metrics" className="space-y-4">
          <TabsList>
            <TabsTrigger value="metrics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t("metrics") || "Métricas"}
            </TabsTrigger>
            <TabsTrigger value="active" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {t("active_flags")} ({activeFlags.length})
            </TabsTrigger>
            <TabsTrigger value="resolved" className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {t("resolved")} ({resolvedFlags.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="metrics">
            <FraudMetricsDashboard flags={flags} />
          </TabsContent>

          <TabsContent value="active">
            <Card>
              <CardContent className="pt-4">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  renderFlagTable(activeFlags)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resolved">
            <Card>
              <CardContent className="pt-4">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  renderFlagTable(resolvedFlags, true)
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* View Details Dialog */}
        <Dialog open={!!selectedFlag && !resolveDialogOpen} onOpenChange={(open) => !open && setSelectedFlag(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                {t("fraud_flag_details")}
              </DialogTitle>
            </DialogHeader>
            {selectedFlag && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">{t("witness")}</label>
                    <p className="font-medium">{selectedFlag.witness_profile?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedFlag.witness_profile?.phone}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">{t("afroloc_code")}</label>
                    <p className="font-mono">{selectedFlag.afroloc_record?.code || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">{t("type")}</label>
                    <div className="mt-1">{getFlagTypeBadge(selectedFlag.flag_type)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">{t("severity")}</label>
                    <div className="mt-1">{getSeverityBadge(selectedFlag.severity)}</div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">{t("description")}</label>
                    <p className="mt-1">{selectedFlag.description || "-"}</p>
                  </div>
                  {selectedFlag.metadata && Object.keys(selectedFlag.metadata).length > 0 && (
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-muted-foreground">{t("metadata")}</label>
                      <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-auto">
                        {JSON.stringify(selectedFlag.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">{t("created_at")}</label>
                    <p>{format(new Date(selectedFlag.created_at), "dd/MM/yyyy HH:mm", { locale: dateLocale })}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">{t("status")}</label>
                    <div className="mt-1">
                      {selectedFlag.resolved ? (
                        <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {t("resolved")}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          {t("active")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {selectedFlag.resolved && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t("resolved_by")}</label>
                        <p>{selectedFlag.resolver_profile?.full_name || "-"}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t("resolved_at")}</label>
                        <p>{selectedFlag.resolved_at ? format(new Date(selectedFlag.resolved_at), "dd/MM/yyyy HH:mm", { locale: dateLocale }) : "-"}</p>
                      </div>
                      <div className="col-span-2">
                        <label className="text-sm font-medium text-muted-foreground">{t("resolution_notes")}</label>
                        <p className="mt-1">{selectedFlag.resolution_notes || "-"}</p>
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  {!selectedFlag.resolved && (
                    <Button
                      onClick={() => setResolveDialogOpen(true)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {t("resolve_flag")}
                    </Button>
                  )}
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Resolve Dialog */}
        <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("resolve_fraud_flag")}</DialogTitle>
              <DialogDescription>
                {t("resolve_fraud_flag_description")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t("resolution_notes")}</label>
                <Textarea
                  placeholder={t("resolution_notes_placeholder")}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={4}
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
                {t("cancel")}
              </Button>
              <Button onClick={handleResolve} disabled={resolving}>
                {resolving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                {t("resolve")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
