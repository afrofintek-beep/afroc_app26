import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  GitCompare, 
  Plus, 
  X, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  MapPin,
  Users,
  Clock,
  Target
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend } from "recharts";

interface RegionSelection {
  id: string;
  country: string;
  countryName: string;
  level1?: string;
  level1Name?: string;
  level2?: string;
  level2Name?: string;
}

interface RegionMetrics {
  regionId: string;
  regionName: string;
  totalRecords: number;
  approvalRate: number;
  avgVerificationTime: number;
  avgGPSAccuracy: number;
  witnessConfirmationRate: number;
  gpsValidatedPercent: number;
}

interface RegionComparisonPanelProps {
  period: string;
  countries: Array<{
    country_code: string;
    country_name: string;
    level1_label: string | null;
    level2_label: string | null;
  }> | undefined;
}

const RegionComparisonPanel = ({ period, countries }: RegionComparisonPanelProps) => {
  const { t } = useLanguage();
  const [regions, setRegions] = useState<RegionSelection[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newRegion, setNewRegion] = useState<Partial<RegionSelection>>({});

  // Fetch level 1 divisions for new region selection
  const { data: level1Divisions } = useQuery({
    queryKey: ["compare-level1", newRegion.country],
    queryFn: async () => {
      if (!newRegion.country) return [];
      const { data, error } = await supabase
        .from("administrative_divisions")
        .select("code, name")
        .eq("country_code", newRegion.country)
        .eq("level", 1)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!newRegion.country
  });

  // Fetch level 2 divisions for new region selection
  const { data: level2Divisions } = useQuery({
    queryKey: ["compare-level2", newRegion.country, newRegion.level1],
    queryFn: async () => {
      if (!newRegion.country || !newRegion.level1) return [];
      const { data, error } = await supabase
        .from("administrative_divisions")
        .select("code, name")
        .eq("country_code", newRegion.country)
        .eq("level", 2)
        .eq("parent_code", newRegion.level1)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!newRegion.country && !!newRegion.level1
  });

  // Fetch metrics for all selected regions
  const { data: comparisonData, isLoading } = useQuery({
    queryKey: ["region-comparison", regions, period],
    queryFn: async (): Promise<RegionMetrics[]> => {
      if (regions.length === 0) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      const metricsPromises = regions.map(async (region) => {
        let query = supabase
          .from("afroloc_records")
          .select("*")
          .gte("created_at", startDate.toISOString())
          .eq("country", region.country);

        if (region.level1) {
          query = query.eq("level1_code", region.level1);
        }
        if (region.level2) {
          query = query.eq("level2_code", region.level2);
        }

        const { data: records, error } = await query;
        if (error) throw error;

        const recordIds = records?.map(r => r.id) || [];
        let witnesses: any[] = [];
        
        if (recordIds.length > 0) {
          const { data: witnessData } = await supabase
            .from("afroloc_witnesses")
            .select("*")
            .in("afroloc_record_id", recordIds);
          witnesses = witnessData || [];
        }

        const totalRecords = records?.length || 0;
        const verifiedRecords = records?.filter(r => r.status === "verified").length || 0;
        const certifiedRecords = records?.filter(r => r.status === "certified").length || 0;
        const gpsValidatedCount = records?.filter(r => r.gps_validated_at).length || 0;

        const verifiedWithTime = records?.filter(r => r.status !== "draft" && r.updated_at && r.created_at) || [];
        let avgVerificationTime = 0;
        if (verifiedWithTime.length > 0) {
          const totalTime = verifiedWithTime.reduce((acc, r) => {
            const created = new Date(r.created_at!).getTime();
            const updated = new Date(r.updated_at!).getTime();
            return acc + (updated - created);
          }, 0);
          avgVerificationTime = totalTime / verifiedWithTime.length / (1000 * 60 * 60);
        }

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
            const R = 6371000;
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

        const totalWitnesses = witnesses?.length || 0;
        const confirmedWitnesses = witnesses?.filter(w => w.status === "confirmed").length || 0;

        const approvalRate = totalRecords > 0 
          ? ((verifiedRecords + certifiedRecords) / totalRecords) * 100 
          : 0;

        const witnessConfirmationRate = totalWitnesses > 0 
          ? (confirmedWitnesses / totalWitnesses) * 100 
          : 0;

        const gpsValidatedPercent = totalRecords > 0 
          ? (gpsValidatedCount / totalRecords) * 100 
          : 0;

        const regionName = region.level2Name || region.level1Name || region.countryName;

        return {
          regionId: region.id,
          regionName,
          totalRecords,
          approvalRate,
          avgVerificationTime,
          avgGPSAccuracy,
          witnessConfirmationRate,
          gpsValidatedPercent
        };
      });

      return Promise.all(metricsPromises);
    },
    enabled: regions.length > 0
  });

  const addRegion = () => {
    if (!newRegion.country) return;

    const countryData = countries?.find(c => c.country_code === newRegion.country);
    const level1Data = level1Divisions?.find(d => d.code === newRegion.level1);
    const level2Data = level2Divisions?.find(d => d.code === newRegion.level2);

    const region: RegionSelection = {
      id: `${newRegion.country}-${newRegion.level1 || 'all'}-${newRegion.level2 || 'all'}-${Date.now()}`,
      country: newRegion.country,
      countryName: countryData?.country_name || newRegion.country,
      level1: newRegion.level1,
      level1Name: level1Data?.name,
      level2: newRegion.level2,
      level2Name: level2Data?.name
    };

    setRegions([...regions, region]);
    setNewRegion({});
    setIsAdding(false);
  };

  const removeRegion = (id: string) => {
    setRegions(regions.filter(r => r.id !== id));
  };

  const getComparisonIcon = (current: number, other: number) => {
    if (current > other * 1.05) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (current < other * 0.95) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const chartData = comparisonData?.map(region => ({
    name: region.regionName.length > 15 ? region.regionName.slice(0, 15) + '...' : region.regionName,
    [t("kpi_approval_rate")]: region.approvalRate,
    [t("kpi_witness_confirmation")]: region.witnessConfirmationRate,
    [t("kpi_gps_validated")]: region.gpsValidatedPercent
  })) || [];

  const chartConfig = {
    [t("kpi_approval_rate")]: { label: t("kpi_approval_rate"), color: "hsl(var(--chart-1))" },
    [t("kpi_witness_confirmation")]: { label: t("kpi_witness_confirmation"), color: "hsl(var(--chart-2))" },
    [t("kpi_gps_validated")]: { label: t("kpi_gps_validated"), color: "hsl(var(--chart-3))" }
  };

  const currentCountry = countries?.find(c => c.country_code === newRegion.country);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              {t("kpi_region_comparison")}
            </CardTitle>
            <CardDescription>{t("kpi_region_comparison_desc")}</CardDescription>
          </div>
          {regions.length < 5 && !isAdding && (
            <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {t("kpi_add_region")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Region Form */}
        {isAdding && (
          <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
            <div className="flex flex-wrap gap-3">
              <Select
                value={newRegion.country}
                onValueChange={(value) => setNewRegion({ country: value })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("select_country")} />
                </SelectTrigger>
                <SelectContent>
                  {countries?.map(country => (
                    <SelectItem key={country.country_code} value={country.country_code}>
                      {country.country_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {newRegion.country && level1Divisions && level1Divisions.length > 0 && (
                <Select
                  value={newRegion.level1}
                  onValueChange={(value) => setNewRegion({ ...newRegion, level1: value, level2: undefined })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={currentCountry?.level1_label || t("province")} />
                  </SelectTrigger>
                  <SelectContent>
                    {level1Divisions?.map(div => (
                      <SelectItem key={div.code} value={div.code}>
                        {div.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {newRegion.level1 && level2Divisions && level2Divisions.length > 0 && (
                <Select
                  value={newRegion.level2}
                  onValueChange={(value) => setNewRegion({ ...newRegion, level2: value })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={currentCountry?.level2_label || t("territory")} />
                  </SelectTrigger>
                  <SelectContent>
                    {level2Divisions?.map(div => (
                      <SelectItem key={div.code} value={div.code}>
                        {div.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addRegion} disabled={!newRegion.country}>
                {t("add")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewRegion({}); }}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        )}

        {/* Selected Regions Tags */}
        {regions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {regions.map((region, index) => (
              <Badge 
                key={region.id} 
                variant="secondary" 
                className="flex items-center gap-1 py-1"
                style={{ 
                  borderLeft: `3px solid hsl(var(--chart-${(index % 5) + 1}))` 
                }}
              >
                {region.level2Name || region.level1Name || region.countryName}
                <button onClick={() => removeRegion(region.id)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Loading State */}
        {isLoading && regions.length > 0 && (
          <div className="space-y-3">
            <Skeleton className="h-[200px] w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          </div>
        )}

        {/* Comparison Chart */}
        {!isLoading && comparisonData && comparisonData.length > 1 && (
          <div className="h-[250px]">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey={t("kpi_approval_rate")} fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                  <Bar dataKey={t("kpi_witness_confirmation")} fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  <Bar dataKey={t("kpi_gps_validated")} fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        )}

        {/* Detailed Comparison Table */}
        {!isLoading && comparisonData && comparisonData.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">{t("region")}</th>
                  <th className="text-right py-2 font-medium">
                    <span className="flex items-center justify-end gap-1">
                      <Target className="h-3 w-3" />
                      {t("kpi_approval_rate")}
                    </span>
                  </th>
                  <th className="text-right py-2 font-medium">
                    <span className="flex items-center justify-end gap-1">
                      <Clock className="h-3 w-3" />
                      {t("kpi_avg_time")}
                    </span>
                  </th>
                  <th className="text-right py-2 font-medium">
                    <span className="flex items-center justify-end gap-1">
                      <MapPin className="h-3 w-3" />
                      {t("kpi_gps_precision")}
                    </span>
                  </th>
                  <th className="text-right py-2 font-medium">
                    <span className="flex items-center justify-end gap-1">
                      <Users className="h-3 w-3" />
                      {t("kpi_witnesses")}
                    </span>
                  </th>
                  <th className="text-right py-2 font-medium">{t("kpi_total_records")}</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((region, index) => {
                  const avgApproval = comparisonData.reduce((a, b) => a + b.approvalRate, 0) / comparisonData.length;
                  const avgTime = comparisonData.reduce((a, b) => a + b.avgVerificationTime, 0) / comparisonData.length;
                  const avgGPS = comparisonData.reduce((a, b) => a + b.avgGPSAccuracy, 0) / comparisonData.length;
                  const avgWitness = comparisonData.reduce((a, b) => a + b.witnessConfirmationRate, 0) / comparisonData.length;

                  return (
                    <tr key={region.regionId} className="border-b last:border-0">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: `hsl(var(--chart-${(index % 5) + 1}))` }}
                          />
                          <span className="font-medium">{region.regionName}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {getComparisonIcon(region.approvalRate, avgApproval)}
                          <span>{region.approvalRate.toFixed(1)}%</span>
                        </div>
                        <Progress value={region.approvalRate} className="h-1 mt-1 w-20 ml-auto" />
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {getComparisonIcon(avgTime, region.avgVerificationTime)}
                          <span>{region.avgVerificationTime.toFixed(1)}h</span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {getComparisonIcon(avgGPS, region.avgGPSAccuracy)}
                          <span>{region.avgGPSAccuracy.toFixed(0)}m</span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {getComparisonIcon(region.witnessConfirmationRate, avgWitness)}
                          <span>{region.witnessConfirmationRate.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-medium">{region.totalRecords}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {regions.length === 0 && !isAdding && (
          <div className="text-center py-8 text-muted-foreground">
            <GitCompare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t("kpi_no_regions_selected")}</p>
            <p className="text-sm">{t("kpi_add_regions_to_compare")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RegionComparisonPanel;
