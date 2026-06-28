import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area
} from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { pt, enUS } from "date-fns/locale";
import { TrendingUp, TrendingDown, MapPin, AlertTriangle, BarChart3 } from "lucide-react";

interface FraudFlag {
  id: string;
  flag_type: string;
  severity: string;
  resolved: boolean;
  created_at: string;
  resolved_at?: string | null;
  afroloc_record?: {
    level1_name: string | null;
    level2_name: string | null;
  } | null;
}

interface FraudMetricsDashboardProps {
  flags: FraudFlag[];
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "hsl(0, 84%, 60%)",
  high: "hsl(25, 95%, 53%)",
  medium: "hsl(48, 96%, 53%)",
  low: "hsl(217, 91%, 60%)"
};

const TYPE_COLORS: Record<string, string> = {
  rapid_confirmations: "hsl(280, 87%, 65%)",
  cross_region: "hsl(173, 80%, 40%)",
  collusion: "hsl(340, 82%, 52%)"
};

export function FraudMetricsDashboard({ flags }: FraudMetricsDashboardProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === "pt" ? pt : enUS;

  // Calculate trend data (last 30 days)
  const trendData = useMemo(() => {
    const today = startOfDay(new Date());
    const thirtyDaysAgo = subDays(today, 29);
    const days = eachDayOfInterval({ start: thirtyDaysAgo, end: today });

    return days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayFlags = flags.filter(f => 
        format(new Date(f.created_at), "yyyy-MM-dd") === dayStr
      );
      
      return {
        date: format(day, "dd/MM", { locale: dateLocale }),
        total: dayFlags.length,
        critical: dayFlags.filter(f => f.severity === "critical").length,
        high: dayFlags.filter(f => f.severity === "high").length,
        medium: dayFlags.filter(f => f.severity === "medium").length,
        low: dayFlags.filter(f => f.severity === "low").length,
        resolved: dayFlags.filter(f => f.resolved).length
      };
    });
  }, [flags, dateLocale]);

  // Distribution by severity
  const severityDistribution = useMemo(() => {
    const activeFlags = flags.filter(f => !f.resolved);
    const distribution = [
      { name: t("severity_critical") || "Crítico", value: activeFlags.filter(f => f.severity === "critical").length, color: SEVERITY_COLORS.critical },
      { name: t("severity_high") || "Alto", value: activeFlags.filter(f => f.severity === "high").length, color: SEVERITY_COLORS.high },
      { name: t("severity_medium") || "Médio", value: activeFlags.filter(f => f.severity === "medium").length, color: SEVERITY_COLORS.medium },
      { name: t("severity_low") || "Baixo", value: activeFlags.filter(f => f.severity === "low").length, color: SEVERITY_COLORS.low }
    ].filter(d => d.value > 0);
    return distribution;
  }, [flags, t]);

  // Distribution by type
  const typeDistribution = useMemo(() => {
    const activeFlags = flags.filter(f => !f.resolved);
    return [
      { name: t("fraud_type_rapid_confirmations") || "Rápidas", value: activeFlags.filter(f => f.flag_type === "rapid_confirmations").length, color: TYPE_COLORS.rapid_confirmations },
      { name: t("fraud_type_cross_region") || "Multi-Região", value: activeFlags.filter(f => f.flag_type === "cross_region").length, color: TYPE_COLORS.cross_region },
      { name: t("fraud_type_collusion") || "Conluio", value: activeFlags.filter(f => f.flag_type === "collusion").length, color: TYPE_COLORS.collusion }
    ].filter(d => d.value > 0);
  }, [flags, t]);

  // Distribution by region
  const regionDistribution = useMemo(() => {
    const regionCounts: Record<string, { total: number; critical: number; high: number }> = {};
    
    flags.forEach(flag => {
      const region = flag.afroloc_record?.level1_name || t("unknown") || "Desconhecido";
      if (!regionCounts[region]) {
        regionCounts[region] = { total: 0, critical: 0, high: 0 };
      }
      regionCounts[region].total++;
      if (flag.severity === "critical") regionCounts[region].critical++;
      if (flag.severity === "high") regionCounts[region].high++;
    });

    return Object.entries(regionCounts)
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [flags, t]);

  // Weekly comparison
  const weeklyComparison = useMemo(() => {
    const today = new Date();
    const thisWeekStart = subDays(today, 6);
    const lastWeekStart = subDays(today, 13);
    const lastWeekEnd = subDays(today, 7);

    const thisWeekFlags = flags.filter(f => {
      const date = new Date(f.created_at);
      return date >= thisWeekStart && date <= today;
    });

    const lastWeekFlags = flags.filter(f => {
      const date = new Date(f.created_at);
      return date >= lastWeekStart && date < lastWeekEnd;
    });

    const thisWeekCount = thisWeekFlags.length;
    const lastWeekCount = lastWeekFlags.length;
    const change = lastWeekCount > 0 
      ? ((thisWeekCount - lastWeekCount) / lastWeekCount * 100).toFixed(1)
      : thisWeekCount > 0 ? "100" : "0";

    return {
      thisWeek: thisWeekCount,
      lastWeek: lastWeekCount,
      change: parseFloat(change),
      isIncrease: thisWeekCount > lastWeekCount
    };
  }, [flags]);

  // Resolution rate
  const resolutionRate = useMemo(() => {
    const total = flags.length;
    const resolved = flags.filter(f => f.resolved).length;
    return total > 0 ? ((resolved / total) * 100).toFixed(1) : "0";
  }, [flags]);

  // Average time to resolve (in hours)
  const avgResolutionTime = useMemo(() => {
    const resolvedFlags = flags.filter(f => f.resolved && f.resolved_at);
    if (resolvedFlags.length === 0) return "N/A";

    const totalHours = resolvedFlags.reduce((acc, flag) => {
      const created = new Date(flag.created_at).getTime();
      const resolved = new Date(flag.resolved_at!).getTime();
      return acc + (resolved - created) / (1000 * 60 * 60);
    }, 0);

    const avgHours = totalHours / resolvedFlags.length;
    if (avgHours < 1) return "< 1h";
    if (avgHours < 24) return `${Math.round(avgHours)}h`;
    return `${Math.round(avgHours / 24)}d`;
  }, [flags]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3">
          <p className="font-medium mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("this_week") || "Esta Semana"}</p>
                <p className="text-3xl font-bold">{weeklyComparison.thisWeek}</p>
              </div>
              <div className={`flex items-center gap-1 ${weeklyComparison.isIncrease ? "text-destructive" : "text-green-500"}`}>
                {weeklyComparison.isIncrease ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )}
                <span className="text-sm font-medium">{Math.abs(weeklyComparison.change)}%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t("vs_last_week") || "vs semana anterior"}: {weeklyComparison.lastWeek}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("resolution_rate") || "Taxa de Resolução"}</p>
                <p className="text-3xl font-bold text-green-500">{resolutionRate}%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {flags.filter(f => f.resolved).length} {t("of") || "de"} {flags.length} {t("resolved") || "resolvidos"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("avg_resolution_time") || "Tempo Médio"}</p>
                <p className="text-3xl font-bold">{avgResolutionTime}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t("time_to_resolve") || "Tempo para resolver"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t("fraud_trend_30_days") || "Tendência de Fraude (30 dias)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="critical"
                  name={t("severity_critical") || "Crítico"}
                  stackId="1"
                  stroke={SEVERITY_COLORS.critical}
                  fill={SEVERITY_COLORS.critical}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="high"
                  name={t("severity_high") || "Alto"}
                  stackId="1"
                  stroke={SEVERITY_COLORS.high}
                  fill={SEVERITY_COLORS.high}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="medium"
                  name={t("severity_medium") || "Médio"}
                  stackId="1"
                  stroke={SEVERITY_COLORS.medium}
                  fill={SEVERITY_COLORS.medium}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="low"
                  name={t("severity_low") || "Baixo"}
                  stackId="1"
                  stroke={SEVERITY_COLORS.low}
                  fill={SEVERITY_COLORS.low}
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Severity Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t("distribution_by_severity") || "Distribuição por Severidade"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {severityDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {severityDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  {t("no_active_flags") || "Nenhum flag ativo"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t("distribution_by_type") || "Distribuição por Tipo"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {typeDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name={t("flags") || "Flags"}>
                      {typeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  {t("no_active_flags") || "Nenhum flag ativo"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Region Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t("distribution_by_region") || "Distribuição por Região"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {regionDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }}
                    interval={0}
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="critical" 
                    name={t("severity_critical") || "Crítico"} 
                    stackId="a" 
                    fill={SEVERITY_COLORS.critical} 
                  />
                  <Bar 
                    dataKey="high" 
                    name={t("severity_high") || "Alto"} 
                    stackId="a" 
                    fill={SEVERITY_COLORS.high} 
                  />
                  <Bar 
                    dataKey="total" 
                    name={t("total") || "Total"} 
                    fill="hsl(var(--primary))" 
                    opacity={0.3}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                {t("no_data_available") || "Sem dados disponíveis"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
