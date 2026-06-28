import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  MapPin, 
  Users, 
  CheckCircle2, 
  XCircle,
  Target,
  BarChart3,
  Activity,
  Globe,
  Filter
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import RegionComparisonPanel from "@/components/RegionComparisonPanel";
import MetricAlertsPanel from "@/components/MetricAlertsPanel";

interface KPIMetrics {
  totalRecords: number;
  verifiedRecords: number;
  certifiedRecords: number;
  draftRecords: number;
  approvalRate: number;
  avgVerificationTime: number;
  avgGPSAccuracy: number;
  gpsValidatedCount: number;
  witnessConfirmationRate: number;
  totalWitnesses: number;
  confirmedWitnesses: number;
  rejectedWitnesses: number;
  pendingWitnesses: number;
}

interface TrendData {
  period: string;
  verified: number;
  certified: number;
  draft: number;
}

interface GPSAccuracyData {
  range: string;
  count: number;
  color: string;
}

const CertificationKPIs = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<string>("30");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedLevel1, setSelectedLevel1] = useState<string>("all");
  const [selectedLevel2, setSelectedLevel2] = useState<string>("all");

  // Fetch countries for filter
  const { data: countries } = useQuery({
    queryKey: ["countries-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("countries")
        .select("country_code, country_name, level1_label, level2_label")
        .eq("is_active", true)
        .order("country_name");
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch level 1 divisions based on selected country
  const { data: level1Divisions } = useQuery({
    queryKey: ["level1-divisions-filter", selectedCountry],
    queryFn: async () => {
      if (selectedCountry === "all") return [];
      
      const { data, error } = await supabase
        .from("administrative_divisions")
        .select("code, name")
        .eq("country_code", selectedCountry)
        .eq("level", 1)
        .order("name");
      
      if (error) throw error;
      return data;
    },
    enabled: selectedCountry !== "all"
  });

  // Fetch level 2 divisions based on selected level 1
  const { data: level2Divisions } = useQuery({
    queryKey: ["level2-divisions-filter", selectedCountry, selectedLevel1],
    queryFn: async () => {
      if (selectedCountry === "all" || selectedLevel1 === "all") return [];
      
      const { data, error } = await supabase
        .from("administrative_divisions")
        .select("code, name")
        .eq("country_code", selectedCountry)
        .eq("level", 2)
        .eq("parent_code", selectedLevel1)
        .order("name");
      
      if (error) throw error;
      return data;
    },
    enabled: selectedCountry !== "all" && selectedLevel1 !== "all"
  });

  // Get labels for current country
  const currentCountry = useMemo(() => {
    return countries?.find(c => c.country_code === selectedCountry);
  }, [countries, selectedCountry]);

  // Reset level selections when country changes
  const handleCountryChange = (value: string) => {
    setSelectedCountry(value);
    setSelectedLevel1("all");
    setSelectedLevel2("all");
  };

  // Reset level 2 when level 1 changes
  const handleLevel1Change = (value: string) => {
    setSelectedLevel1(value);
    setSelectedLevel2("all");
  };

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["certification-kpis", period, selectedCountry, selectedLevel1, selectedLevel2],
    queryFn: async (): Promise<KPIMetrics> => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      // Build query with filters
      let recordsQuery = supabase
        .from("afroloc_records")
        .select("*")
        .gte("created_at", startDate.toISOString());

      // Apply geographic filters
      if (selectedCountry !== "all") {
        recordsQuery = recordsQuery.eq("country", selectedCountry);
      }
      if (selectedLevel1 !== "all") {
        recordsQuery = recordsQuery.eq("level1_code", selectedLevel1);
      }
      if (selectedLevel2 !== "all") {
        recordsQuery = recordsQuery.eq("level2_code", selectedLevel2);
      }

      const { data: records, error: recordsError } = await recordsQuery;
      if (recordsError) throw recordsError;

      // Fetch witnesses for filtered records
      const recordIds = records?.map(r => r.id) || [];
      let witnesses: any[] = [];
      
      if (recordIds.length > 0) {
        const { data: witnessData, error: witnessesError } = await supabase
          .from("afroloc_witnesses")
          .select("*")
          .in("afroloc_record_id", recordIds)
          .gte("created_at", startDate.toISOString());

        if (witnessesError) throw witnessesError;
        witnesses = witnessData || [];
      }

      const totalRecords = records?.length || 0;
      const verifiedRecords = records?.filter(r => r.status === "verified").length || 0;
      const certifiedRecords = records?.filter(r => r.status === "certified").length || 0;
      const draftRecords = records?.filter(r => r.status === "draft").length || 0;
      const gpsValidatedCount = records?.filter(r => r.gps_validated_at).length || 0;

      // Calculate average verification time (in hours)
      const verifiedWithTime = records?.filter(r => r.status !== "draft" && r.updated_at && r.created_at) || [];
      let avgVerificationTime = 0;
      if (verifiedWithTime.length > 0) {
        const totalTime = verifiedWithTime.reduce((acc, r) => {
          const created = new Date(r.created_at!).getTime();
          const updated = new Date(r.updated_at!).getTime();
          return acc + (updated - created);
        }, 0);
        avgVerificationTime = totalTime / verifiedWithTime.length / (1000 * 60 * 60); // Convert to hours
      }

      // Calculate GPS accuracy (based on EXIF vs device GPS distance)
      const recordsWithGPS = records?.filter(r => 
        r.geo_lat && r.geo_lon && r.photo_exif_gps_lat && r.photo_exif_gps_lon
      ) || [];
      
      let avgGPSAccuracy = 0;
      if (recordsWithGPS.length > 0) {
        const distances = recordsWithGPS.map(r => {
          const lat1 = Number(r.geo_lat);
          const lon1 = Number(r.geo_lon);
          const lat2 = Number(r.photo_exif_gps_lat);
          const lon2 = Number(r.photo_exif_gps_lon);
          
          // Haversine formula for distance
          const R = 6371000; // Earth's radius in meters
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          return R * c;
        });
        avgGPSAccuracy = distances.reduce((a, b) => a + b, 0) / distances.length;
      }

      // Witness stats
      const totalWitnesses = witnesses?.length || 0;
      const confirmedWitnesses = witnesses?.filter(w => w.status === "confirmed").length || 0;
      const rejectedWitnesses = witnesses?.filter(w => w.status === "rejected").length || 0;
      const pendingWitnesses = witnesses?.filter(w => w.status === "pending").length || 0;

      const approvalRate = totalRecords > 0 
        ? ((verifiedRecords + certifiedRecords) / totalRecords) * 100 
        : 0;

      const witnessConfirmationRate = totalWitnesses > 0 
        ? (confirmedWitnesses / totalWitnesses) * 100 
        : 0;

      return {
        totalRecords,
        verifiedRecords,
        certifiedRecords,
        draftRecords,
        approvalRate,
        avgVerificationTime,
        avgGPSAccuracy,
        gpsValidatedCount,
        witnessConfirmationRate,
        totalWitnesses,
        confirmedWitnesses,
        rejectedWitnesses,
        pendingWitnesses
      };
    }
  });

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ["certification-trends", period, selectedCountry, selectedLevel1, selectedLevel2],
    queryFn: async (): Promise<TrendData[]> => {
      const days = parseInt(period);
      const trends: TrendData[] = [];
      
      for (let i = days; i >= 0; i -= Math.ceil(days / 7)) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - i);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - Math.ceil(days / 7));

        let query = supabase
          .from("afroloc_records")
          .select("status, country, level1_code, level2_code")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());

        // Apply geographic filters
        if (selectedCountry !== "all") {
          query = query.eq("country", selectedCountry);
        }
        if (selectedLevel1 !== "all") {
          query = query.eq("level1_code", selectedLevel1);
        }
        if (selectedLevel2 !== "all") {
          query = query.eq("level2_code", selectedLevel2);
        }

        const { data } = await query;

        trends.push({
          period: endDate.toLocaleDateString("pt", { day: "2-digit", month: "short" }),
          verified: data?.filter(r => r.status === "verified").length || 0,
          certified: data?.filter(r => r.status === "certified").length || 0,
          draft: data?.filter(r => r.status === "draft").length || 0
        });
      }
      
      return trends.slice(-7);
    }
  });

  const gpsAccuracyData: GPSAccuracyData[] = [
    { range: "< 10m", count: 45, color: "hsl(var(--chart-1))" },
    { range: "10-50m", count: 30, color: "hsl(var(--chart-2))" },
    { range: "50-100m", count: 15, color: "hsl(var(--chart-3))" },
    { range: "> 100m", count: 10, color: "hsl(var(--chart-4))" }
  ];

  const statusDistribution = [
    { name: t("kpi_status_verified"), value: metrics?.verifiedRecords || 0, color: "hsl(var(--chart-1))" },
    { name: t("kpi_status_certified"), value: metrics?.certifiedRecords || 0, color: "hsl(var(--chart-2))" },
    { name: t("kpi_status_draft"), value: metrics?.draftRecords || 0, color: "hsl(var(--chart-3))" }
  ];

  const chartConfig = {
    verified: { label: t("kpi_status_verified"), color: "hsl(var(--chart-1))" },
    certified: { label: t("kpi_status_certified"), color: "hsl(var(--chart-2))" },
    draft: { label: t("kpi_status_draft"), color: "hsl(var(--chart-3))" }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{t("kpi_certification_title")}</h1>
              <p className="text-muted-foreground">{t("kpi_certification_description")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t("kpi_period")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{t("kpi_last_7_days")}</SelectItem>
                <SelectItem value="30">{t("kpi_last_30_days")}</SelectItem>
                <SelectItem value="90">{t("kpi_last_90_days")}</SelectItem>
                <SelectItem value="365">{t("kpi_last_year")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Geographic Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              {t("kpi_geographic_filters")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {/* Country Filter */}
              <div className="flex flex-col gap-1 min-w-[180px]">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {t("country")}
                </label>
                <Select value={selectedCountry} onValueChange={handleCountryChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("kpi_all_countries")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("kpi_all_countries")}</SelectItem>
                    {countries?.map(country => (
                      <SelectItem key={country.country_code} value={country.country_code}>
                        {country.country_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Level 1 Filter */}
              {selectedCountry !== "all" && (
                <div className="flex flex-col gap-1 min-w-[180px]">
                  <label className="text-xs text-muted-foreground">
                    {currentCountry?.level1_label || t("province")}
                  </label>
                  <Select value={selectedLevel1} onValueChange={handleLevel1Change}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("kpi_all_regions")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("kpi_all_regions")}</SelectItem>
                      {level1Divisions?.map(div => (
                        <SelectItem key={div.code} value={div.code}>
                          {div.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Level 2 Filter */}
              {selectedCountry !== "all" && selectedLevel1 !== "all" && (
                <div className="flex flex-col gap-1 min-w-[180px]">
                  <label className="text-xs text-muted-foreground">
                    {currentCountry?.level2_label || t("territory")}
                  </label>
                  <Select value={selectedLevel2} onValueChange={setSelectedLevel2}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("kpi_all_districts")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("kpi_all_districts")}</SelectItem>
                      {level2Divisions?.map(div => (
                        <SelectItem key={div.code} value={div.code}>
                          {div.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Active Filters Badge */}
              {(selectedCountry !== "all" || selectedLevel1 !== "all" || selectedLevel2 !== "all") && (
                <div className="flex items-end">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setSelectedCountry("all");
                      setSelectedLevel1("all");
                      setSelectedLevel2("all");
                    }}
                    className="text-xs"
                  >
                    {t("kpi_clear_filters")}
                  </Button>
                </div>
              )}
            </div>

            {/* Active Filter Summary */}
            {(selectedCountry !== "all") && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                <Badge variant="secondary" className="text-xs">
                  {countries?.find(c => c.country_code === selectedCountry)?.country_name}
                </Badge>
                {selectedLevel1 !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    {level1Divisions?.find(d => d.code === selectedLevel1)?.name}
                  </Badge>
                )}
                {selectedLevel2 !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    {level2Divisions?.find(d => d.code === selectedLevel2)?.name}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricsLoading ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    {t("kpi_approval_rate")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{metrics?.approvalRate.toFixed(1)}%</span>
                    {metrics && metrics.approvalRate >= 70 ? (
                      <Badge variant="default" className="bg-green-500">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {t("kpi_good")}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <TrendingDown className="h-3 w-3 mr-1" />
                        {t("kpi_low")}
                      </Badge>
                    )}
                  </div>
                  <Progress value={metrics?.approvalRate || 0} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {t("kpi_avg_verification_time")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">
                      {metrics?.avgVerificationTime.toFixed(1)}h
                    </span>
                    {metrics && metrics.avgVerificationTime <= 24 ? (
                      <Badge variant="default" className="bg-green-500">{t("kpi_fast")}</Badge>
                    ) : metrics && metrics.avgVerificationTime <= 72 ? (
                      <Badge variant="secondary">{t("kpi_normal")}</Badge>
                    ) : (
                      <Badge variant="destructive">{t("kpi_slow")}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("kpi_avg_verification_time_desc")}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {t("kpi_gps_precision")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">
                      {metrics?.avgGPSAccuracy.toFixed(0)}m
                    </span>
                    {metrics && metrics.avgGPSAccuracy <= 10 ? (
                      <Badge variant="default" className="bg-green-500">{t("kpi_excellent")}</Badge>
                    ) : metrics && metrics.avgGPSAccuracy <= 50 ? (
                      <Badge variant="secondary">{t("kpi_good")}</Badge>
                    ) : (
                      <Badge variant="destructive">{t("kpi_low")}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("kpi_gps_precision_desc")}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {t("kpi_witness_confirmation")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">
                      {metrics?.witnessConfirmationRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex gap-2 mt-2 text-xs">
                    <span className="text-green-500">{metrics?.confirmedWitnesses} ✓</span>
                    <span className="text-red-500">{metrics?.rejectedWitnesses} ✗</span>
                    <span className="text-muted-foreground">{metrics?.pendingWitnesses} ⏳</span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {t("kpi_total_records")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">{t("kpi_status_verified")}</span>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{metrics?.verifiedRecords || 0}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">{t("kpi_status_certified")}</span>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="font-medium">{metrics?.certifiedRecords || 0}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">{t("kpi_status_draft")}</span>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{metrics?.draftRecords || 0}</span>
                  </div>
                </div>
                <div className="border-t pt-2 flex justify-between items-center font-medium">
                  <span>{t("total")}</span>
                  <span>{metrics?.totalRecords || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {t("kpi_gps_validations")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("kpi_validated_by_authority")}</span>
                  <Badge variant="outline">{metrics?.gpsValidatedCount || 0}</Badge>
                </div>
                <Progress 
                  value={metrics && metrics.totalRecords > 0 
                    ? (metrics.gpsValidatedCount / metrics.totalRecords) * 100 
                    : 0
                  } 
                />
                <p className="text-xs text-muted-foreground">
                  {metrics && metrics.totalRecords > 0 
                    ? ((metrics.gpsValidatedCount / metrics.totalRecords) * 100).toFixed(1)
                    : 0
                  }% {t("kpi_records_validated_by_authority")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                {t("kpi_status_distribution")}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[120px]">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={45}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("kpi_certification_trend")}</CardTitle>
              <CardDescription>{t("kpi_certification_trend_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {trendLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line 
                        type="monotone" 
                        dataKey="verified" 
                        stroke="hsl(var(--chart-1))" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="certified" 
                        stroke="hsl(var(--chart-2))" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="draft" 
                        stroke="hsl(var(--chart-3))" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("kpi_gps_distribution")}</CardTitle>
              <CardDescription>{t("kpi_gps_distribution_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gpsAccuracyData}>
                    <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {gpsAccuracyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Region Comparison Panel */}
        <RegionComparisonPanel period={period} countries={countries} />

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("kpi_metrics_legend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="space-y-1">
                <p className="font-medium">{t("kpi_approval_rate")}</p>
                <p className="text-muted-foreground">
                  {t("kpi_approval_rate_legend")}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium">{t("kpi_avg_verification_time")}</p>
                <p className="text-muted-foreground">
                  {t("kpi_avg_verification_time_legend")}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium">{t("kpi_gps_precision")}</p>
                <p className="text-muted-foreground">
                  {t("kpi_gps_precision_legend")}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium">{t("kpi_witness_confirmation")}</p>
                <p className="text-muted-foreground">
                  {t("kpi_witness_confirmation_legend")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metric Alerts Panel */}
        <MetricAlertsPanel period={period} />
      </div>
    </DashboardLayout>
  );
};

export default CertificationKPIs;
