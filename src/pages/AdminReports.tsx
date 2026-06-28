import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, Users, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { useLanguage } from "@/contexts/LanguageContext";

interface ReportData {
  total_validations: number;
  approved_count: number;
  rejected_count: number;
  pending_count: number;
  approval_rate: number;
  avg_response_time: number;
}

const AdminReports = () => {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [period, setPeriod] = useState("7");
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadReportData();
    }
  }, [period, loading]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/landing");
      return;
    }
    setLoading(false);
  };

  const loadReportData = async () => {
    try {
      const daysAgo = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      const { data: witnesses, error } = await supabase
        .from('afroloc_witnesses')
        .select('status, created_at, validated_at, otp_sent_at')
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      const total = witnesses?.length || 0;
      const approved = witnesses?.filter(w => w.status === 'confirmed').length || 0;
      const rejected = witnesses?.filter(w => w.status === 'rejected').length || 0;
      const pending = witnesses?.filter(w => w.status === 'pending').length || 0;

      // Calculate average response time (in hours)
      const responseTimes = witnesses
        ?.filter(w => w.validated_at && w.otp_sent_at)
        .map(w => {
          const sent = new Date(w.otp_sent_at!).getTime();
          const validated = new Date(w.validated_at!).getTime();
          return (validated - sent) / (1000 * 60 * 60); // Convert to hours
        }) || [];

      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

      const approvalRate = (approved + rejected) > 0 
        ? (approved / (approved + rejected)) * 100 
        : 0;

      setReportData({
        total_validations: total,
        approved_count: approved,
        rejected_count: rejected,
        pending_count: pending,
        approval_rate: approvalRate,
        avg_response_time: avgResponseTime,
      });
    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error(t('error_loading_report'));
    }
  };

  const exportToExcel = async () => {
    try {
      setExporting(true);

      const daysAgo = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      const { data: witnesses, error } = await supabase
        .from('afroloc_witnesses')
        .select(`
          id,
          witness_afro_id,
          status,
          created_at,
          validated_at,
          otp_sent_at,
          rejection_reason,
          afroloc_records (
            code,
            geo_lat,
            geo_lon,
            country,
            level1_name,
            level2_name,
            level3_name,
            level4_name
          )
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data for Excel
      const excelData = witnesses?.map(w => {
        const afroid = (w as any).afroloc_records;
        const geoCoords = afroid?.geo_lat && afroid?.geo_lon
          ? `${afroid.geo_lat}, ${afroid.geo_lon}`
          : "";
        
        const responseTime = w.validated_at && w.otp_sent_at
          ? ((new Date(w.validated_at).getTime() - new Date(w.otp_sent_at).getTime()) / (1000 * 60)).toFixed(2)
          : "";

        return {
          'ID': w.id,
          'Testemunha': w.witness_afro_id,
          'Status': w.status === 'confirmed' ? 'Confirmada' : w.status === 'rejected' ? 'Rejeitada' : 'Pendente',
          'Código AFROLOC': afroid?.code || '',
          'Coordenadas': geoCoords,
          'País': afroid?.country || '',
          'Nível 1': afroid?.level1_name || '',
          'Nível 2': afroid?.level2_name || '',
          'Nível 3': afroid?.level3_name || '',
          'Nível 4': afroid?.level4_name || '',
          'Criado em': new Date(w.created_at).toLocaleString('pt-BR'),
          'SMS Enviado em': w.otp_sent_at ? new Date(w.otp_sent_at).toLocaleString('pt-BR') : '',
          'Validado em': w.validated_at ? new Date(w.validated_at).toLocaleString('pt-BR') : '',
          'Tempo de Resposta (min)': responseTime,
          'Motivo Rejeição': w.rejection_reason || '',
        };
      }) || [];

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Validações");

      // Auto-size columns
      const maxWidth = excelData.reduce((w, r) => Math.max(w, ...Object.keys(r).map(k => k.length)), 10);
      ws['!cols'] = Object.keys(excelData[0] || {}).map(() => ({ wch: maxWidth }));

      // Export file
      const fileName = `relatorio-validacoes-${period}dias-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success(t('report_exported_success'));
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error(t('export_error'));
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">{t('loading')}...</p>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/dashboard")}
                className="flex-shrink-0 mt-1"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{t('reports_analytics')}</h1>
                <p className="text-muted-foreground">{t('detailed_analysis')}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('select_period')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">{t('last_7_days')}</SelectItem>
                  <SelectItem value="30">{t('last_30_days')}</SelectItem>
                  <SelectItem value="90">{t('last_90_days')}</SelectItem>
                  <SelectItem value="365">{t('last_year')}</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={exportToExcel} disabled={exporting}>
                <Download className="mr-2 h-4 w-4" />
                {exporting ? t('exporting') : t('export_excel')}
              </Button>
            </div>
          </div>

          {/* Empty state */}
          {reportData && reportData.total_validations === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center mb-6">
              <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">{t('no_reports_title')}</h2>
              <p className="text-muted-foreground max-w-md">{t('no_reports_desc')}</p>
            </div>
          ) : (
          <>
          {/* Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('total')}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData?.total_validations || 0}</div>
                <p className="text-xs text-muted-foreground">{t('total_validations')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('approved')}</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{reportData?.approved_count || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {((reportData?.approved_count || 0) / (reportData?.total_validations || 1) * 100).toFixed(1)}% {t('of_total')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('rejected')}</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{reportData?.rejected_count || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {((reportData?.rejected_count || 0) / (reportData?.total_validations || 1) * 100).toFixed(1)}% {t('of_total')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('approval_rate')}</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData?.approval_rate.toFixed(1) || 0}%</div>
                <p className="text-xs text-muted-foreground">{t('of_responded_validations')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('average_time')}</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData?.avg_response_time.toFixed(1) || 0}h</div>
                <p className="text-xs text-muted-foreground">{t('response_time')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Additional Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t('report_information')}</CardTitle>
              <CardDescription>{t('consolidated_data')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium">{t('period_analyzed')}</span>
                  <span>{period} {t('days')}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium">{t('pending_validations')}</span>
                  <span className="text-yellow-600 font-bold">{reportData?.pending_count || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium">{t('response_rate')}</span>
                  <span className="font-bold">
                    {(((reportData?.approved_count || 0) + (reportData?.rejected_count || 0)) / (reportData?.total_validations || 1) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          </>
          )}
          </div>
    </DashboardLayout>
  );
};

export default AdminReports;
