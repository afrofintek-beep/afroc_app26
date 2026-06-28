import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Shield, 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  MapPin,
  Search,
  Download,
  RefreshCw,
  Settings,
  Bell,
  GitCompare
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";

interface AddressRecord {
  id: string;
  code: string;
  user_id: string;
  country: string;
  level1_name: string | null;
  level2_name: string | null;
  level3_name: string | null;
  level4_name: string | null;
  street_name: string | null;
  number: string | null;
  last_verified_at: string | null;
  next_verification_due: string | null;
  status: string;
}

interface RiskMetrics {
  totalAddresses: number;
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
  criticalRisk: number;
  avgRiskScore: number;
  overdueVerifications: number;
  completeAddresses: number;
  incompleteAddresses: number;
}

interface RiskTrendData {
  date: string;
  avgRisk: number;
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
  criticalRisk: number;
  predicted?: boolean;
}

interface AlertSettings {
  id?: string;
  alertType: 'email' | 'sms' | 'both';
  highRiskThreshold: number;
  criticalRiskThreshold: number;
  trendIncreaseThreshold: number;
  enabled: boolean;
}

interface ComparisonData {
  date: string;
  [key: string]: number | string;
}

export default function AdminRiskDashboard() {
  const [records, setRecords] = useState<AddressRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AddressRecord[]>([]);
  const [metrics, setMetrics] = useState<RiskMetrics>({
    totalAddresses: 0,
    lowRisk: 0,
    mediumRisk: 0,
    highRisk: 0,
    criticalRisk: 0,
    avgRiskScore: 0,
    overdueVerifications: 0,
    completeAddresses: 0,
    incompleteAddresses: 0,
  });
  const [trendData, setTrendData] = useState<RiskTrendData[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    alertType: 'email',
    highRiskThreshold: 75,
    criticalRiskThreshold: 85,
    trendIncreaseThreshold: 15,
    enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    country: 'all',
    region: 'all',
    riskLevel: 'all',
    complianceStatus: 'all',
    search: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAddressRecords();
    fetchAlertSettings();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [records, filters]);

  useEffect(() => {
    calculateComparisonData();
  }, [records, selectedRegions]);

  const calculateRiskScore = (record: AddressRecord) => {
    const now = new Date();
    const hasFullAddress = !!(record.street_name && record.number);
    const cycleDurationMonths = hasFullAddress ? 6 : 3;
    
    let riskScore = 0;
    
    // Address completeness (0-30 points)
    if (!hasFullAddress) {
      riskScore += 30;
    } else {
      riskScore += 5;
    }
    
    // Cycle progress (0-40 points)
    if (record.next_verification_due) {
      const dueDate = new Date(record.next_verification_due);
      const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDue < 0) {
        riskScore += 40; // Overdue
      } else if (daysUntilDue < 30) {
        riskScore += 30; // Due soon
      } else if (daysUntilDue < 60) {
        riskScore += 15; // Approaching
      }
    } else {
      riskScore += 40; // No verification scheduled
    }
    
    // Verification history (0-30 points)
    if (record.last_verified_at) {
      const daysSinceVerification = Math.floor(
        (now.getTime() - new Date(record.last_verified_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      const expectedDays = cycleDurationMonths * 30;
      
      if (daysSinceVerification > expectedDays * 1.2) {
        riskScore += 30;
      } else if (daysSinceVerification > expectedDays) {
        riskScore += 20;
      } else if (daysSinceVerification > expectedDays * 0.8) {
        riskScore += 10;
      }
    } else {
      riskScore += 30;
    }
    
    return Math.min(Math.max(riskScore, 0), 100);
  };

  const getRiskLevel = (score: number): 'low' | 'medium' | 'high' | 'critical' => {
    if (score < 30) return 'low';
    if (score < 50) return 'medium';
    if (score < 75) return 'high';
    return 'critical';
  };

  const fetchAddressRecords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('afroloc_records')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setRecords(data || []);
      calculateMetrics(data || []);
      
      // Extract unique regions
      const regions = [...new Set(data?.map(r => r.level1_name).filter(Boolean))] as string[];
      setAvailableRegions(regions);
      if (regions.length > 0 && selectedRegions.length === 0) {
        setSelectedRegions([regions[0]]);
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Falha ao carregar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAlertSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('risk_alert_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching alert settings:', error);
        return;
      }

      if (data) {
        setAlertSettings({
          id: data.id,
          alertType: data.alert_type as 'email' | 'sms' | 'both',
          highRiskThreshold: data.high_risk_threshold,
          criticalRiskThreshold: data.critical_risk_threshold,
          trendIncreaseThreshold: data.trend_increase_threshold,
          enabled: data.enabled,
        });
      }
    } catch (error: any) {
      console.error('Error in fetchAlertSettings:', error);
    }
  };

  const saveAlertSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const settingsData = {
        user_id: user.id,
        alert_type: alertSettings.alertType,
        high_risk_threshold: alertSettings.highRiskThreshold,
        critical_risk_threshold: alertSettings.criticalRiskThreshold,
        trend_increase_threshold: alertSettings.trendIncreaseThreshold,
        enabled: alertSettings.enabled,
      };

      const { error } = await supabase
        .from('risk_alert_settings')
        .upsert(settingsData);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Configurações de alerta salvas com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Falha ao salvar configurações",
        variant: "destructive",
      });
    }
  };

  const calculateComparisonData = () => {
    if (!selectedRegions.length || !records.length) {
      setComparisonData([]);
      return;
    }

    const now = new Date();
    const data: ComparisonData[] = [];

    // Calculate trends for last 6 months
    for (let i = 24; i >= 0; i--) {
      const weekDate = new Date(now);
      weekDate.setDate(weekDate.getDate() - (i * 7));
      const dateStr = weekDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

      const dataPoint: ComparisonData = { date: dateStr };

      selectedRegions.forEach(region => {
        const regionRecords = records.filter(r => r.level1_name === region);
        if (regionRecords.length > 0) {
          let totalRisk = 0;
          regionRecords.forEach(record => {
            totalRisk += calculateRiskScore(record);
          });
          dataPoint[region] = Math.round(totalRisk / regionRecords.length);
        } else {
          dataPoint[region] = 0;
        }
      });

      data.push(dataPoint);
    }

    setComparisonData(data);
  };

  const calculateMetrics = (data: AddressRecord[]) => {
    const newMetrics: RiskMetrics = {
      totalAddresses: data.length,
      lowRisk: 0,
      mediumRisk: 0,
      highRisk: 0,
      criticalRisk: 0,
      avgRiskScore: 0,
      overdueVerifications: 0,
      completeAddresses: 0,
      incompleteAddresses: 0,
    };

    let totalScore = 0;
    const now = new Date();

    data.forEach(record => {
      const score = calculateRiskScore(record);
      const level = getRiskLevel(score);
      totalScore += score;

      // Count by risk level
      if (level === 'low') newMetrics.lowRisk++;
      else if (level === 'medium') newMetrics.mediumRisk++;
      else if (level === 'high') newMetrics.highRisk++;
      else newMetrics.criticalRisk++;

      // Check if overdue
      if (record.next_verification_due && new Date(record.next_verification_due) < now) {
        newMetrics.overdueVerifications++;
      }

      // Count complete vs incomplete addresses
      if (record.street_name && record.number) {
        newMetrics.completeAddresses++;
      } else {
        newMetrics.incompleteAddresses++;
      }
    });

    newMetrics.avgRiskScore = data.length > 0 ? Math.round(totalScore / data.length) : 0;
    setMetrics(newMetrics);
    calculateTrendData(data);
  };

  const calculateTrendData = (data: AddressRecord[]) => {
    const trends: RiskTrendData[] = [];
    const now = new Date();
    
    // Calculate historical data (last 6 months, weekly)
    for (let i = 24; i >= 0; i--) {
      const weekDate = new Date(now);
      weekDate.setDate(weekDate.getDate() - (i * 7));
      
      let totalRisk = 0;
      let countLow = 0, countMedium = 0, countHigh = 0, countCritical = 0;
      let recordCount = 0;

      data.forEach(record => {
        // Include all existing records for historical trend
        recordCount++;
        const score = calculateRiskScore(record);
        totalRisk += score;
        
        const level = getRiskLevel(score);
        if (level === 'low') countLow++;
        else if (level === 'medium') countMedium++;
        else if (level === 'high') countHigh++;
        else countCritical++;
      });

      if (recordCount > 0) {
        trends.push({
          date: weekDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
          avgRisk: Math.round(totalRisk / recordCount),
          lowRisk: countLow,
          mediumRisk: countMedium,
          highRisk: countHigh,
          criticalRisk: countCritical,
        });
      }
    }

    // Predictive analytics (next 8 weeks)
    const lastTrend = trends[trends.length - 1];
    if (lastTrend) {
      // Calculate trend direction
      const trendSlope = trends.length > 4 
        ? (lastTrend.avgRisk - trends[trends.length - 5].avgRisk) / 4 
        : 0;

      for (let i = 1; i <= 8; i++) {
        const futureDate = new Date(now);
        futureDate.setDate(futureDate.getDate() + (i * 7));
        
        // Predict based on current trend + overdue verification impact
        const predictedRisk = Math.min(100, Math.max(0, 
          lastTrend.avgRisk + (trendSlope * i) + (metrics.overdueVerifications > 0 ? i * 2 : 0)
        ));

        trends.push({
          date: futureDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
          avgRisk: Math.round(predictedRisk),
          lowRisk: 0,
          mediumRisk: 0,
          highRisk: 0,
          criticalRisk: 0,
          predicted: true,
        });
      }
    }

    setTrendData(trends);
  };

  const applyFilters = () => {
    let filtered = [...records];

    // Country filter
    if (filters.country !== 'all') {
      filtered = filtered.filter(r => r.country === filters.country);
    }

    // Region filter (Level 1)
    if (filters.region !== 'all') {
      filtered = filtered.filter(r => r.level1_name === filters.region);
    }

    // Risk level filter
    if (filters.riskLevel !== 'all') {
      filtered = filtered.filter(r => {
        const level = getRiskLevel(calculateRiskScore(r));
        return level === filters.riskLevel;
      });
    }

    // Compliance status filter
    if (filters.complianceStatus !== 'all') {
      const now = new Date();
      filtered = filtered.filter(r => {
        const isOverdue = r.next_verification_due && new Date(r.next_verification_due) < now;
        if (filters.complianceStatus === 'overdue') return isOverdue;
        if (filters.complianceStatus === 'compliant') return !isOverdue;
        return true;
      });
    }

    // Search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(r => 
        r.code.toLowerCase().includes(search) ||
        r.level1_name?.toLowerCase().includes(search) ||
        r.level2_name?.toLowerCase().includes(search) ||
        r.street_name?.toLowerCase().includes(search)
      );
    }

    setFilteredRecords(filtered);
  };

  const exportData = () => {
    const csv = [
      ['AFROLOC', 'País', 'Região', 'Endereço', 'Score de Risco', 'Nível', 'Última Verificação', 'Próxima Verificação'],
      ...filteredRecords.map(r => {
        const score = calculateRiskScore(r);
        const level = getRiskLevel(score);
        return [
          r.code,
          r.country,
          r.level1_name || '-',
          `${r.street_name || ''} ${r.number || ''}`.trim() || 'Incompleto',
          score,
          level,
          r.last_verified_at ? new Date(r.last_verified_at).toLocaleDateString('pt-BR') : 'Nunca',
          r.next_verification_due ? new Date(r.next_verification_due).toLocaleDateString('pt-BR') : '-',
        ];
      })
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `risk-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-chart-2 text-white';
      case 'medium': return 'bg-chart-3 text-white';
      case 'high': return 'bg-warning text-white';
      case 'critical': return 'bg-destructive text-white';
      default: return 'bg-muted';
    }
  };

  return (
    <DashboardLayout>
      <Tabs defaultValue="overview" className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="overview">
              <Shield className="h-4 w-4 mr-2" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="comparison">
              <GitCompare className="h-4 w-4 mr-2" />
              Comparação
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <Bell className="h-4 w-4 mr-2" />
              Alertas
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button onClick={fetchAddressRecords} variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button onClick={exportData} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-6">

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de Endereços</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{metrics.totalAddresses}</div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-chart-2/50 bg-chart-2/5">
            <CardHeader className="pb-2">
              <CardDescription>Risco Baixo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-chart-2">{metrics.lowRisk}</div>
                <div className="text-sm text-muted-foreground">
                  {metrics.totalAddresses > 0 ? Math.round((metrics.lowRisk / metrics.totalAddresses) * 100) : 0}%
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-chart-3/50 bg-chart-3/5">
            <CardHeader className="pb-2">
              <CardDescription>Risco Médio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-chart-3">{metrics.mediumRisk}</div>
                <div className="text-sm text-muted-foreground">
                  {metrics.totalAddresses > 0 ? Math.round((metrics.mediumRisk / metrics.totalAddresses) * 100) : 0}%
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-warning/50 bg-warning/5">
            <CardHeader className="pb-2">
              <CardDescription>Risco Alto</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-warning">{metrics.highRisk}</div>
                <div className="text-sm text-muted-foreground">
                  {metrics.totalAddresses > 0 ? Math.round((metrics.highRisk / metrics.totalAddresses) * 100) : 0}%
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardDescription>Risco Crítico</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-destructive">{metrics.criticalRisk}</div>
                <div className="text-sm text-muted-foreground">
                  {metrics.totalAddresses > 0 ? Math.round((metrics.criticalRisk / metrics.totalAddresses) * 100) : 0}%
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Risk Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Tendência de Risco ao Longo do Tempo
            </CardTitle>
            <CardDescription>
              Histórico dos últimos 6 meses e previsão das próximas 8 semanas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="predictedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'avgRisk') return [`${value}`, 'Score Médio'];
                    return [value, name];
                  }}
                />
                <Legend 
                  wrapperStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value) => {
                    if (value === 'avgRisk') return 'Score Médio de Risco';
                    return value;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="avgRisk"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  fill="url(#riskGradient)"
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (payload.predicted) {
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill="hsl(var(--warning))"
                          stroke="hsl(var(--warning))"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                        />
                      );
                    }
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill="hsl(var(--primary))"
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      />
                    );
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-muted-foreground">Dados Históricos</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning border-2 border-dashed border-warning/50" />
                <span className="text-muted-foreground">Previsão (Próximas 8 semanas)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Score Médio de Risco</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{metrics.avgRiskScore}</div>
              <p className="text-sm text-muted-foreground mt-1">de 100</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Verificações Atrasadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-destructive">{metrics.overdueVerifications}</div>
              <p className="text-sm text-muted-foreground mt-1">requer ação imediata</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Completude de Endereços</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Completos:</span>
                  <span className="font-semibold">{metrics.completeAddresses}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Incompletos:</span>
                  <span className="font-semibold">{metrics.incompleteAddresses}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500"
                    style={{ 
                      width: `${metrics.totalAddresses > 0 ? (metrics.completeAddresses / metrics.totalAddresses) * 100 : 0}%` 
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Select value={filters.riskLevel} onValueChange={(v) => setFilters(f => ({ ...f, riskLevel: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Nível de Risco" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os níveis</SelectItem>
                  <SelectItem value="low">Risco Baixo</SelectItem>
                  <SelectItem value="medium">Risco Médio</SelectItem>
                  <SelectItem value="high">Risco Alto</SelectItem>
                  <SelectItem value="critical">Risco Crítico</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.complianceStatus} onValueChange={(v) => setFilters(f => ({ ...f, complianceStatus: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Status de Conformidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="compliant">Em Conformidade</SelectItem>
                  <SelectItem value="overdue">Atrasado</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative md:col-span-3">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por AFROLOC, região, endereço..."
                  value={filters.search}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Records Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registros ({filteredRecords.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredRecords.slice(0, 50).map((record) => {
                const score = calculateRiskScore(record);
                const level = getRiskLevel(score);
                const isOverdue = record.next_verification_due && new Date(record.next_verification_due) < new Date();

                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{record.code}</span>
                        {isOverdue && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Atrasado
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{record.level1_name || record.country}</span>
                        {record.street_name && <span>• {record.street_name} {record.number}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold">{score}</div>
                        <div className="text-xs text-muted-foreground">Score</div>
                      </div>
                      <Badge className={getRiskBadgeColor(level)}>
                        {level === 'low' && 'Baixo'}
                        {level === 'medium' && 'Médio'}
                        {level === 'high' && 'Alto'}
                        {level === 'critical' && 'Crítico'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {filteredRecords.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum registro encontrado com os filtros aplicados
                </div>
              )}
              {filteredRecords.length > 50 && (
                <div className="text-center text-sm text-muted-foreground pt-4">
                  Mostrando 50 de {filteredRecords.length} registros
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-primary" />
                Comparação Regional de Risco
              </CardTitle>
              <CardDescription>
                Compare tendências de risco entre diferentes regiões
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {availableRegions.map(region => (
                    <Badge
                      key={region}
                      variant={selectedRegions.includes(region) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        if (selectedRegions.includes(region)) {
                          setSelectedRegions(selectedRegions.filter(r => r !== region));
                        } else {
                          setSelectedRegions([...selectedRegions, region]);
                        }
                      }}
                    >
                      {region}
                    </Badge>
                  ))}
                </div>
                {comparisonData.length > 0 && (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        domain={[0, 100]}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))'
                        }}
                      />
                      <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }} />
                      {selectedRegions.map((region, index) => {
                        const colors = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];
                        return (
                          <Line
                            key={region}
                            type="monotone"
                            dataKey={region}
                            stroke={colors[index % colors.length]}
                            strokeWidth={2}
                            dot={{ r: 4 }}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Configurações de Alertas
              </CardTitle>
              <CardDescription>
                Configure alertas automáticos por email e SMS
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="alerts-enabled">Alertas Ativados</Label>
                    <p className="text-sm text-muted-foreground">
                      Receba notificações quando o risco atingir limiares críticos
                    </p>
                  </div>
                  <Switch
                    id="alerts-enabled"
                    checked={alertSettings.enabled}
                    onCheckedChange={(checked) => 
                      setAlertSettings({ ...alertSettings, enabled: checked })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alert-type">Tipo de Alerta</Label>
                  <Select 
                    value={alertSettings.alertType} 
                    onValueChange={(value: 'email' | 'sms' | 'both') => 
                      setAlertSettings({ ...alertSettings, alertType: value })
                    }
                  >
                    <SelectTrigger id="alert-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email apenas</SelectItem>
                      <SelectItem value="sms">SMS apenas</SelectItem>
                      <SelectItem value="both">Email e SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="high-threshold">Limiar Risco Alto</Label>
                    <Input
                      id="high-threshold"
                      type="number"
                      min="0"
                      max="100"
                      value={alertSettings.highRiskThreshold}
                      onChange={(e) => 
                        setAlertSettings({ 
                          ...alertSettings, 
                          highRiskThreshold: parseInt(e.target.value) 
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="critical-threshold">Limiar Risco Crítico</Label>
                    <Input
                      id="critical-threshold"
                      type="number"
                      min="0"
                      max="100"
                      value={alertSettings.criticalRiskThreshold}
                      onChange={(e) => 
                        setAlertSettings({ 
                          ...alertSettings, 
                          criticalRiskThreshold: parseInt(e.target.value) 
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trend-threshold">Aumento de Tendência (%)</Label>
                    <Input
                      id="trend-threshold"
                      type="number"
                      min="0"
                      max="100"
                      value={alertSettings.trendIncreaseThreshold}
                      onChange={(e) => 
                        setAlertSettings({ 
                          ...alertSettings, 
                          trendIncreaseThreshold: parseInt(e.target.value) 
                        })
                      }
                    />
                  </div>
                </div>

                <Button onClick={saveAlertSettings} className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}