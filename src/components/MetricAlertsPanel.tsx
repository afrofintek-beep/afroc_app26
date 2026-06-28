import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle2, 
  Settings2, 
  ChevronDown,
  Target,
  Clock,
  MapPin,
  Users,
  TrendingDown,
  Info
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface ThresholdConfig {
  approvalRate: number;
  avgVerificationTime: number;
  gpsAccuracy: number;
  witnessConfirmationRate: number;
  enabled: boolean;
}

interface RegionAlert {
  regionName: string;
  regionCode: string;
  country: string;
  metric: string;
  metricLabel: string;
  currentValue: number;
  threshold: number;
  severity: "warning" | "critical";
}

interface MetricAlertsPanelProps {
  period: string;
}

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  approvalRate: 70,
  avgVerificationTime: 48, // hours
  gpsAccuracy: 100, // meters
  witnessConfirmationRate: 60,
  enabled: true
};

const MetricAlertsPanel = ({ period }: MetricAlertsPanelProps) => {
  const { t } = useLanguage();
  const [thresholds, setThresholds] = useState<ThresholdConfig>(DEFAULT_THRESHOLDS);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [localThresholds, setLocalThresholds] = useState<ThresholdConfig>(DEFAULT_THRESHOLDS);

  // Load saved thresholds from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("metric-alert-thresholds");
    if (saved) {
      const parsed = JSON.parse(saved);
      setThresholds(parsed);
      setLocalThresholds(parsed);
    }
  }, []);

  // Fetch all regions and their metrics
  const { data: alerts, isLoading } = useQuery({
    queryKey: ["metric-alerts", period, thresholds],
    queryFn: async (): Promise<RegionAlert[]> => {
      if (!thresholds.enabled) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      // Fetch all level1 regions with their metrics
      const { data: divisions } = await supabase
        .from("administrative_divisions")
        .select("code, name, country_code")
        .eq("level", 1);

      if (!divisions) return [];

      const alertsList: RegionAlert[] = [];

      for (const division of divisions) {
        // Fetch records for this region
        const { data: records } = await supabase
          .from("afroloc_records")
          .select("*")
          .eq("country", division.country_code)
          .eq("level1_code", division.code)
          .gte("created_at", startDate.toISOString());

        if (!records || records.length < 5) continue; // Skip regions with too few records

        const totalRecords = records.length;
        const verifiedRecords = records.filter(r => r.status === "verified").length;
        const certifiedRecords = records.filter(r => r.status === "certified").length;
        const approvalRate = ((verifiedRecords + certifiedRecords) / totalRecords) * 100;

        // Calculate avg verification time
        const verifiedWithTime = records.filter(r => r.status !== "draft" && r.updated_at && r.created_at);
        let avgVerificationTime = 0;
        if (verifiedWithTime.length > 0) {
          const totalTime = verifiedWithTime.reduce((acc, r) => {
            const created = new Date(r.created_at!).getTime();
            const updated = new Date(r.updated_at!).getTime();
            return acc + (updated - created);
          }, 0);
          avgVerificationTime = totalTime / verifiedWithTime.length / (1000 * 60 * 60);
        }

        // Calculate GPS accuracy
        const recordsWithGPS = records.filter(r => 
          r.geo_lat && r.geo_lon && r.photo_exif_gps_lat && r.photo_exif_gps_lon
        );
        
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

        // Fetch witnesses for this region
        const recordIds = records.map(r => r.id);
        const { data: witnesses } = await supabase
          .from("afroloc_witnesses")
          .select("status")
          .in("afroloc_record_id", recordIds);

        const totalWitnesses = witnesses?.length || 0;
        const confirmedWitnesses = witnesses?.filter(w => w.status === "confirmed").length || 0;
        const witnessConfirmationRate = totalWitnesses > 0 
          ? (confirmedWitnesses / totalWitnesses) * 100 
          : 100; // If no witnesses, consider OK

        // Check thresholds and create alerts
        if (approvalRate < thresholds.approvalRate) {
          alertsList.push({
            regionName: division.name,
            regionCode: division.code,
            country: division.country_code,
            metric: "approvalRate",
            metricLabel: t("kpi_approval_rate"),
            currentValue: approvalRate,
            threshold: thresholds.approvalRate,
            severity: approvalRate < thresholds.approvalRate * 0.7 ? "critical" : "warning"
          });
        }

        if (avgVerificationTime > thresholds.avgVerificationTime && avgVerificationTime > 0) {
          alertsList.push({
            regionName: division.name,
            regionCode: division.code,
            country: division.country_code,
            metric: "avgVerificationTime",
            metricLabel: t("kpi_avg_time"),
            currentValue: avgVerificationTime,
            threshold: thresholds.avgVerificationTime,
            severity: avgVerificationTime > thresholds.avgVerificationTime * 1.5 ? "critical" : "warning"
          });
        }

        if (avgGPSAccuracy > thresholds.gpsAccuracy && avgGPSAccuracy > 0) {
          alertsList.push({
            regionName: division.name,
            regionCode: division.code,
            country: division.country_code,
            metric: "gpsAccuracy",
            metricLabel: t("kpi_gps_precision"),
            currentValue: avgGPSAccuracy,
            threshold: thresholds.gpsAccuracy,
            severity: avgGPSAccuracy > thresholds.gpsAccuracy * 2 ? "critical" : "warning"
          });
        }

        if (witnessConfirmationRate < thresholds.witnessConfirmationRate && totalWitnesses > 0) {
          alertsList.push({
            regionName: division.name,
            regionCode: division.code,
            country: division.country_code,
            metric: "witnessConfirmationRate",
            metricLabel: t("kpi_witness_confirmation"),
            currentValue: witnessConfirmationRate,
            threshold: thresholds.witnessConfirmationRate,
            severity: witnessConfirmationRate < thresholds.witnessConfirmationRate * 0.7 ? "critical" : "warning"
          });
        }
      }

      // Sort by severity (critical first) then by how far below threshold
      return alertsList.sort((a, b) => {
        if (a.severity !== b.severity) {
          return a.severity === "critical" ? -1 : 1;
        }
        const aDeviation = a.metric.includes("Time") || a.metric.includes("Accuracy")
          ? a.currentValue / a.threshold
          : a.threshold / a.currentValue;
        const bDeviation = b.metric.includes("Time") || b.metric.includes("Accuracy")
          ? b.currentValue / b.threshold
          : b.threshold / b.currentValue;
        return bDeviation - aDeviation;
      });
    },
    enabled: thresholds.enabled,
    refetchInterval: 300000 // Refresh every 5 minutes
  });

  const saveThresholds = () => {
    setThresholds(localThresholds);
    localStorage.setItem("metric-alert-thresholds", JSON.stringify(localThresholds));
    setIsConfigOpen(false);
    toast.success(t("alert_thresholds_saved"));
  };

  const resetThresholds = () => {
    setLocalThresholds(DEFAULT_THRESHOLDS);
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case "approvalRate": return <Target className="h-4 w-4" />;
      case "avgVerificationTime": return <Clock className="h-4 w-4" />;
      case "gpsAccuracy": return <MapPin className="h-4 w-4" />;
      case "witnessConfirmationRate": return <Users className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const formatMetricValue = (metric: string, value: number) => {
    switch (metric) {
      case "approvalRate":
      case "witnessConfirmationRate":
        return `${value.toFixed(1)}%`;
      case "avgVerificationTime":
        return `${value.toFixed(1)}h`;
      case "gpsAccuracy":
        return `${value.toFixed(0)}m`;
      default:
        return value.toFixed(1);
    }
  };

  const criticalAlerts = alerts?.filter(a => a.severity === "critical") || [];
  const warningAlerts = alerts?.filter(a => a.severity === "warning") || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t("alert_thresholds_title")}
              {thresholds.enabled && alerts && alerts.length > 0 && (
                <Badge variant={criticalAlerts.length > 0 ? "destructive" : "secondary"}>
                  {alerts.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{t("alert_thresholds_description")}</CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsConfigOpen(!isConfigOpen)}
          >
            <Settings2 className="h-4 w-4 mr-1" />
            {t("configure")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuration Panel */}
        <Collapsible open={isConfigOpen} onOpenChange={setIsConfigOpen}>
          <CollapsibleContent>
            <div className="p-4 border rounded-lg bg-muted/50 space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="alerts-enabled" className="font-medium">
                  {t("alert_enabled")}
                </Label>
                <Switch 
                  id="alerts-enabled"
                  checked={localThresholds.enabled}
                  onCheckedChange={(checked) => 
                    setLocalThresholds({ ...localThresholds, enabled: checked })
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="threshold-approval" className="text-sm flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    {t("alert_threshold_approval")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="threshold-approval"
                      type="number"
                      min="0"
                      max="100"
                      value={localThresholds.approvalRate}
                      onChange={(e) => 
                        setLocalThresholds({ ...localThresholds, approvalRate: Number(e.target.value) })
                      }
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="threshold-time" className="text-sm flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {t("alert_threshold_time")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="threshold-time"
                      type="number"
                      min="1"
                      value={localThresholds.avgVerificationTime}
                      onChange={(e) => 
                        setLocalThresholds({ ...localThresholds, avgVerificationTime: Number(e.target.value) })
                      }
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">{t("hours")}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="threshold-gps" className="text-sm flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {t("alert_threshold_gps")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="threshold-gps"
                      type="number"
                      min="1"
                      value={localThresholds.gpsAccuracy}
                      onChange={(e) => 
                        setLocalThresholds({ ...localThresholds, gpsAccuracy: Number(e.target.value) })
                      }
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">m</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="threshold-witness" className="text-sm flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {t("alert_threshold_witness")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="threshold-witness"
                      type="number"
                      min="0"
                      max="100"
                      value={localThresholds.witnessConfirmationRate}
                      onChange={(e) => 
                        setLocalThresholds({ ...localThresholds, witnessConfirmationRate: Number(e.target.value) })
                      }
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={saveThresholds}>
                  {t("save")}
                </Button>
                <Button size="sm" variant="ghost" onClick={resetThresholds}>
                  {t("reset")}
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Alerts Display */}
        {!thresholds.enabled ? (
          <div className="text-center py-6 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{t("alert_disabled_message")}</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : alerts && alerts.length > 0 ? (
          <div className="space-y-3">
            {/* Critical Alerts */}
            {criticalAlerts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {t("alert_critical")} ({criticalAlerts.length})
                </h4>
                {criticalAlerts.slice(0, 5).map((alert, idx) => (
                  <Alert key={idx} variant="destructive" className="py-2">
                    <TrendingDown className="h-4 w-4" />
                    <AlertTitle className="flex items-center gap-2 text-sm">
                      {getMetricIcon(alert.metric)}
                      {alert.regionName}
                    </AlertTitle>
                    <AlertDescription className="text-xs">
                      {alert.metricLabel}: {formatMetricValue(alert.metric, alert.currentValue)} 
                      <span className="opacity-70">
                        {" "}({t("alert_threshold")}: {formatMetricValue(alert.metric, alert.threshold)})
                      </span>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {/* Warning Alerts */}
            {warningAlerts.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-500 w-full hover:underline">
                  <AlertTriangle className="h-4 w-4" />
                  {t("alert_warning")} ({warningAlerts.length})
                  <ChevronDown className="h-4 w-4 ml-auto" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {warningAlerts.slice(0, 10).map((alert, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"
                    >
                      <div className="flex items-center gap-2">
                        {getMetricIcon(alert.metric)}
                        <div>
                          <p className="text-sm font-medium">{alert.regionName}</p>
                          <p className="text-xs text-muted-foreground">{alert.metricLabel}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-amber-600 dark:text-amber-500">
                          {formatMetricValue(alert.metric, alert.currentValue)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("alert_threshold")}: {formatMetricValue(alert.metric, alert.threshold)}
                        </p>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-muted-foreground">{t("alert_no_issues")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MetricAlertsPanel;
