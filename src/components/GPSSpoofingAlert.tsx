import { useMemo, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  ShieldX, 
  Info, 
  MapPin, 
  Clock, 
  Zap,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Phone
} from "lucide-react";
import { 
  SpoofingDetectionInput, 
  SpoofingDetectionResult, 
  detectGPSSpoofing,
  getRiskLevelColors,
  SpoofingAlert
} from "@/utils/gpsSpoofingDetection";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLanguage } from "@/contexts/LanguageContext";

interface GPSSpoofingAlertProps {
  deviceGPS?: { latitude: number; longitude: number; accuracy?: number } | null;
  exifGPS?: { latitude: number; longitude: number } | null;
  exifTimestamp?: string | null;
  deviceTimestamp?: Date;
  showDetails?: boolean;
  onRiskAssessed?: (result: SpoofingDetectionResult) => void;
  className?: string;
  /** 
   * When true, shows simplified public-facing messages instead of technical details.
   * Hides GPS coordinates, risk scores, and spoofing detection specifics for security.
   */
  publicView?: boolean;
  /** Contact information to display when validation fails (only used in publicView mode) */
  contactInfo?: string;
}

export function GPSSpoofingAlert({
  deviceGPS,
  exifGPS,
  exifTimestamp,
  deviceTimestamp = new Date(),
  showDetails = true,
  onRiskAssessed,
  className = "",
  publicView = false,
  contactInfo
}: GPSSpoofingAlertProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useLanguage();

  const detectionResult = useMemo(() => {
    const input: SpoofingDetectionInput = {
      deviceGPS: deviceGPS
        ? {
            latitude: deviceGPS.latitude,
            longitude: deviceGPS.longitude,
            accuracy: deviceGPS.accuracy,
          }
        : null,
      exifGPS: exifGPS
        ? {
            latitude: exifGPS.latitude,
            longitude: exifGPS.longitude,
          }
        : null,
      exifTimestamp,
      deviceTimestamp,
    };

    return detectGPSSpoofing(input);
  }, [deviceGPS, exifGPS, exifTimestamp, deviceTimestamp]);

  useEffect(() => {
    onRiskAssessed?.(detectionResult);
  }, [detectionResult, onRiskAssessed]);

  const colors = getRiskLevelColors(detectionResult.riskLevel);

  const visibleAlerts = useMemo(() => {
    // When the overall assessment is "none", a missing EXIF GPS is informational and
    // shouldn't be shown as an "alert" (it confuses users because GPS is already validated).
    if (detectionResult.riskLevel === 'none') {
      return detectionResult.alerts.filter((a) => a.code !== 'NO_EXIF_GPS');
    }
    return detectionResult.alerts;
  }, [detectionResult.alerts, detectionResult.riskLevel]);

  const getAlertIcon = (type: SpoofingAlert['type']) => {
    switch (type) {
      case 'critical':
        return <ShieldX className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getRiskIcon = () => {
    switch (detectionResult.riskLevel) {
      case 'critical':
        return <ShieldX className={`h-5 w-5 ${colors.icon}`} />;
      case 'high':
        return <ShieldAlert className={`h-5 w-5 ${colors.icon}`} />;
      case 'medium':
      case 'low':
        return <AlertTriangle className={`h-5 w-5 ${colors.icon}`} />;
      default:
        return <ShieldCheck className={`h-5 w-5 ${colors.icon}`} />;
    }
  };

  const getRiskLabel = () => {
    switch (detectionResult.riskLevel) {
      case 'critical':
        return t('gps_spoofing_risk_critical');
      case 'high':
        return t('gps_spoofing_risk_high');
      case 'medium':
        return t('gps_spoofing_risk_medium');
      case 'low':
        return t('gps_spoofing_risk_low');
      default:
        return t('gps_spoofing_validated');
    }
  };

  // Don't show anything if no GPS data
  if (!deviceGPS && !exifGPS) {
    return null;
  }

  // PUBLIC VIEW: Show simplified messages with risk score but without technical details
  if (publicView) {
    const isValidated = detectionResult.riskLevel === 'none' || detectionResult.riskLevel === 'low';
    
    if (isValidated) {
      return (
        <Card className={`border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 ${className}`}>
          <CardContent className="pt-6 space-y-3">
            <Alert className="border-0 bg-transparent p-0">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <AlertTitle className="text-green-700 dark:text-green-300 font-semibold">
                {t('public_validation_complete')}
              </AlertTitle>
              <AlertDescription className="text-green-600 dark:text-green-400 mt-1">
                {t('public_address_confirmed')}
              </AlertDescription>
            </Alert>
            
            {/* Risk Score - visible in public view */}
            <div className="space-y-1.5 pt-2 border-t border-green-200 dark:border-green-800">
              <div className="flex justify-between text-xs">
                <span className="text-green-700 dark:text-green-300 font-medium">{t('gps_spoofing_risk_level')}</span>
                <span className="text-green-600 dark:text-green-400 font-semibold">{detectionResult.riskScore}/100</span>
              </div>
              <Progress 
                value={detectionResult.riskScore} 
                className="h-2 bg-green-100 dark:bg-green-900"
              />
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className={`border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 ${className}`}>
        <CardContent className="pt-6 space-y-3">
          <Alert className="border-0 bg-transparent p-0">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-700 dark:text-amber-300 font-semibold">
              {t('public_verification_required')}
            </AlertTitle>
            <AlertDescription className="text-amber-600 dark:text-amber-400 mt-1 space-y-2">
              <p>{t('public_contact_services')}</p>
              {contactInfo && (
                <p className="flex items-center gap-2 font-medium">
                  <Phone className="h-4 w-4" />
                  {contactInfo}
                </p>
              )}
            </AlertDescription>
          </Alert>
          
          {/* Risk Score - visible in public view */}
          <div className="space-y-1.5 pt-2 border-t border-amber-200 dark:border-amber-800">
            <div className="flex justify-between text-xs">
              <span className="text-amber-700 dark:text-amber-300 font-medium">{t('gps_spoofing_risk_level')}</span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold">{detectionResult.riskScore}/100</span>
            </div>
            <Progress 
              value={detectionResult.riskScore} 
              className="h-2 bg-amber-100 dark:bg-amber-900"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // INTERNAL VIEW: Show full technical details (original behavior)
  // For no risk, show minimal success indicator
  if (detectionResult.riskLevel === 'none' && visibleAlerts.length === 0) {
    return (
      <Alert className={`${colors.bg} ${colors.border} border ${className}`}>
        <ShieldCheck className={`h-4 w-4 ${colors.icon}`} />
        <AlertTitle className={colors.text}>{t('gps_spoofing_validated')}</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          {t('gps_spoofing_no_anomaly')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={`${colors.border} border ${className}`}>
      <CardHeader className={`pb-2 ${colors.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getRiskIcon()}
            <CardTitle className={`text-base ${colors.text}`}>
              {t('gps_spoofing_verification_title')}
            </CardTitle>
          </div>
          <Badge 
            variant="outline" 
            className={`${colors.bg} ${colors.text} ${colors.border}`}
          >
            {getRiskLabel()}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {t('gps_spoofing_anti_spoofing_system')} • Score: {detectionResult.riskScore}/100
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        {/* Risk Score Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t('gps_spoofing_risk_level')}</span>
            <span>{detectionResult.riskScore}%</span>
          </div>
          <Progress 
            value={detectionResult.riskScore} 
            className="h-2"
          />
        </div>

        {/* Recommendation */}
        <Alert className={`${colors.bg} ${colors.border} border`}>
          {getRiskIcon()}
          <AlertDescription className={`text-sm ${colors.text}`}>
            {detectionResult.recommendation}
          </AlertDescription>
        </Alert>

        {/* Expandable Alert Details */}
        {showDetails && visibleAlerts.length > 0 && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full flex items-center justify-between text-xs"
              >
                <span>{visibleAlerts.length} {t('gps_spoofing_alerts_detected')}</span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              {visibleAlerts.map((alert, index) => {
                const alertColors = getRiskLevelColors(
                  alert.type === 'critical' ? 'critical' : 
                  alert.type === 'warning' ? 'medium' : 'low'
                );
                
                return (
                  <Alert 
                    key={index} 
                    className={`${alertColors.bg} ${alertColors.border} border`}
                  >
                    <div className="flex items-start gap-2">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1 min-w-0">
                        <AlertTitle className={`text-sm ${alertColors.text}`}>
                          {alert.title}
                        </AlertTitle>
                        <AlertDescription className="text-xs text-muted-foreground mt-1">
                          {alert.message}
                        </AlertDescription>
                        {alert.details && (
                          <p className="text-xs font-mono text-muted-foreground mt-1 break-all">
                            {alert.details}
                          </p>
                        )}
                      </div>
                    </div>
                  </Alert>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* GPS Comparison Summary */}
        {deviceGPS && exifGPS && (
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
            <div className="space-y-1">
              <p className="text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {t('gps_spoofing_device_gps')}
              </p>
              <p className="font-mono">
                {deviceGPS.latitude.toFixed(6)}, {deviceGPS.longitude.toFixed(6)}
              </p>
              {deviceGPS.accuracy && (
                <p className="text-muted-foreground">±{Math.round(deviceGPS.accuracy)}m</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" /> {t('gps_spoofing_exif_gps')}
              </p>
              <p className="font-mono">
                {exifGPS.latitude.toFixed(6)}, {exifGPS.longitude.toFixed(6)}
              </p>
            </div>
          </div>
        )}

        {/* Timestamp Comparison */}
        {exifTimestamp && (
          <div className="text-xs pt-2 border-t">
            <p className="text-muted-foreground flex items-center gap-1 mb-1">
              <Clock className="h-3 w-3" /> {t('gps_spoofing_photo_timestamp')}
            </p>
            <p className="font-mono">{new Date(exifTimestamp).toLocaleString()}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
