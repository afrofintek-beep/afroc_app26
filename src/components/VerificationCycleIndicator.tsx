import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Home, AlertTriangle, CheckCircle2, Clock, TrendingDown, Shield } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS, fr, ar } from "date-fns/locale";
import { calculateVerificationRisk, shouldShowVerificationCycle, type AddressRiskInput } from "@/utils/verificationRisk";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface VerificationCycleIndicatorProps {
  // Address data
  streetName?: string | null;
  number?: string | null;
  streetCode?: string | null;
  addressType?: string | null;
  propertyType?: string | null;
  
  // Validation status
  status?: string | null;
  lastVerifiedAt?: string | null;
  nextVerificationDue?: string | null;
  
  // GPS data
  geoLat?: number | null;
  geoLon?: number | null;
  gpsValidatedAt?: string | null;
  photoExifGpsLat?: number | null;
  photoExifGpsLon?: number | null;
  
  // Witness data
  witnessCount?: number;
  confirmedWitnessCount?: number;
  
  // ATS Score
  atsScore?: number | null;
  
  // Registration date
  createdAt?: string | null;
}

export const VerificationCycleIndicator = ({
  streetName,
  number,
  streetCode,
  addressType,
  propertyType,
  status,
  lastVerifiedAt,
  nextVerificationDue,
  geoLat,
  geoLon,
  gpsValidatedAt,
  photoExifGpsLat,
  photoExifGpsLon,
  witnessCount = 0,
  confirmedWitnessCount = 0,
  atsScore,
  createdAt,
}: VerificationCycleIndicatorProps) => {
  const { t, language } = useLanguage();
  
  // Get the appropriate date-fns locale
  const getDateLocale = () => {
    switch (language) {
      case 'pt': return ptBR;
      case 'fr': return fr;
      case 'ar': return ar;
      default: return enUS;
    }
  };
  
  // Only show for validated addresses
  const shouldShow = shouldShowVerificationCycle(status);
  
  const riskData = useMemo(() => {
    if (!shouldShow) return null;
    
    const input: AddressRiskInput = {
      streetName,
      number,
      streetCode,
      addressType,
      propertyType,
      status,
      lastVerifiedAt,
      nextVerificationDue,
      geoLat,
      geoLon,
      gpsValidatedAt,
      photoExifGpsLat,
      photoExifGpsLon,
      witnessCount,
      confirmedWitnessCount,
      atsScore,
      createdAt,
    };
    
    return calculateVerificationRisk(input);
  }, [
    shouldShow,
    streetName,
    number,
    streetCode,
    addressType,
    propertyType,
    status,
    lastVerifiedAt,
    nextVerificationDue,
    geoLat,
    geoLon,
    gpsValidatedAt,
    photoExifGpsLat,
    photoExifGpsLon,
    witnessCount,
    confirmedWitnessCount,
    atsScore,
    createdAt,
  ]);
  
  // Don't render if address is not validated
  if (!shouldShow || !riskData) {
    return null;
  }

  const getStatusIcon = () => {
    switch (riskData.status) {
      case 'overdue':
      case 'urgent':
        return AlertTriangle;
      case 'upcoming':
        return Clock;
      default:
        return CheckCircle2;
    }
  };
  
  const getTranslatedStatusLabel = () => {
    switch (riskData.status) {
      case 'overdue':
        return t('verification_expired');
      case 'urgent':
        return t('verification_urgent');
      case 'upcoming':
        return t('verification_upcoming');
      default:
        return t('verification_on_time');
    }
  };
  
  const getTranslatedRiskLabel = () => {
    switch (riskData.riskLevel) {
      case 'very_low':
        return t('risk_very_low');
      case 'low':
        return t('risk_low');
      case 'medium':
        return t('risk_medium');
      case 'high':
        return t('risk_high');
      case 'very_high':
        return t('risk_critical');
      default:
        return t('risk_medium');
    }
  };
  
  const StatusIcon = getStatusIcon();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="h-12 w-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${riskData.riskColor}20` }}
            >
              <Calendar className="h-6 w-6" style={{ color: riskData.riskColor }} />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl flex items-center gap-2">
                {t('verification_cycle')}
                <Badge 
                  variant="outline" 
                  className="text-xs"
                  style={{ 
                    borderColor: riskData.riskColor,
                    color: riskData.riskColor 
                  }}
                >
                  {t('times_per_year').replace('{count}', String(riskData.verificationsPerYear))}
                </Badge>
              </CardTitle>
              <CardDescription>
                {t('verification_cycle_frequency').replace('{score}', String(riskData.riskScore))}
              </CardDescription>
            </div>
          </div>
          
          {/* Risk Score Badge */}
          <div className="flex flex-col items-end">
            <div 
              className="relative w-16 h-16 rounded-full flex items-center justify-center border-4 transition-all duration-500"
              style={{ borderColor: riskData.riskColor }}
            >
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: riskData.riskColor }}>
                  {riskData.riskScore}
                </div>
                <div className="text-[10px] text-muted-foreground -mt-1">{t('risk')}</div>
              </div>
              {/* Animated pulse ring for high risk */}
              {(riskData.riskLevel === 'high' || riskData.riskLevel === 'very_high') && (
                <div 
                  className="absolute inset-0 rounded-full animate-ping opacity-20"
                  style={{ borderColor: riskData.riskColor, borderWidth: '2px' }}
                />
              )}
            </div>
            <span className="text-xs font-medium mt-1" style={{ color: riskData.riskColor }}>
              {getTranslatedRiskLabel()}
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Current Status Badge */}
        <div 
          className={cn(
            "flex items-center gap-2 p-3 rounded-lg",
            riskData.status === 'verified' && "bg-chart-2/10",
            riskData.status === 'upcoming' && "bg-warning/10",
            (riskData.status === 'urgent' || riskData.status === 'overdue') && "bg-destructive/10"
          )}
        >
          <StatusIcon 
            className="h-5 w-5" 
            style={{ color: riskData.statusColor }} 
          />
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: riskData.statusColor }}>
              {getTranslatedStatusLabel()}
            </p>
            <p className="text-xs text-muted-foreground">
              {riskData.daysRemaining > 0 
                ? t('days_remaining_in_cycle').replace('{days}', String(riskData.daysRemaining))
                : t('cycle_overdue')}
            </p>
          </div>
        </div>

        {/* Cycle Progress Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {t('cycle_x_of_y').replace('{current}', String(riskData.currentCycle)).replace('{total}', String(riskData.verificationsPerYear))}
            </span>
            <span className="text-muted-foreground">
              {t('duration_months').replace('{months}', String(riskData.cycleDurationMonths))}
            </span>
          </div>
          
          {/* Colored progress bar */}
          <div className="relative">
            <div className="h-6 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full transition-all duration-700 ease-out relative"
                style={{
                  width: `${Math.min(riskData.cycleProgress, 100)}%`,
                  backgroundColor: riskData.statusColor,
                }}
              >
                {/* Animated shine effect */}
                <div 
                  className="absolute inset-0 opacity-30"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                    animation: 'shimmer 2s infinite',
                  }}
                />
              </div>
            </div>
            <div 
              className="absolute inset-0 flex items-center justify-center text-xs font-semibold"
              style={{ 
                color: riskData.cycleProgress > 50 ? 'white' : 'inherit',
                textShadow: riskData.cycleProgress > 50 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              {Math.round(riskData.cycleProgress)}%
            </div>
          </div>
        </div>

        {/* Year Overview - Color-coded cycles */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t('annual_overview').replace('{year}', String(new Date().getFullYear())).replace('{cycles}', String(riskData.verificationsPerYear))}
          </p>
          <div className="flex gap-1">
            {Array.from({ length: riskData.verificationsPerYear }).map((_, index) => {
              const cycleNum = index + 1;
              const isCurrent = cycleNum === riskData.currentCycle;
              const isPast = cycleNum < riskData.currentCycle;
              
              let bgColor = 'bg-muted/50';
              let textColor = 'text-muted-foreground/50';
              
              if (isPast) {
                bgColor = 'bg-chart-2';
                textColor = 'text-white';
              } else if (isCurrent) {
                textColor = 'text-white';
              }
              
              return (
                <div
                  key={cycleNum}
                  className={cn(
                    "relative flex-1 h-10 rounded-lg flex items-center justify-center text-xs font-semibold transition-all duration-500 overflow-hidden",
                    isCurrent && "ring-2 ring-primary ring-offset-2 shadow-lg scale-105",
                    !isCurrent && bgColor,
                    textColor
                  )}
                  style={isCurrent ? {
                    background: `linear-gradient(to right, ${riskData.statusColor} ${riskData.cycleProgress}%, hsl(var(--muted)) ${riskData.cycleProgress}%)`
                  } : undefined}
                >
                  {isCurrent && (
                    <div 
                      className="absolute inset-0 opacity-20"
                      style={{
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
                        animation: 'shimmer 2s infinite',
                      }}
                    />
                  )}
                  
                  <span className="relative z-10">C{cycleNum}</span>
                  
                  {isCurrent && (
                    <span className="absolute bottom-1 text-[10px] opacity-70">
                      {Math.round(riskData.cycleProgress)}%
                    </span>
                  )}
                  
                  {isPast && (
                    <span className="absolute top-1 right-1 text-[10px]">✓</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Risk Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">
              {t('risk_criteria')}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: t('completeness'), value: riskData.riskBreakdown.addressCompleteness, max: 20 },
              { label: t('property'), value: riskData.riskBreakdown.propertyStability, max: 15 },
              { label: t('gps_validation'), value: riskData.riskBreakdown.gpsValidation, max: 15 },
              { label: t('witnesses'), value: riskData.riskBreakdown.witnessQuality, max: 15 },
              { label: t('ats_score_label'), value: riskData.riskBreakdown.atsScore, max: 20 },
              { label: t('history'), value: riskData.riskBreakdown.verificationHistory, max: 15 },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <span className={cn(
                  "font-medium",
                  item.value === 0 && "text-chart-2",
                  item.value > 0 && item.value < item.max * 0.5 && "text-chart-3",
                  item.value >= item.max * 0.5 && item.value < item.max * 0.75 && "text-warning",
                  item.value >= item.max * 0.75 && "text-destructive"
                )}>
                  {item.value}/{item.max}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Mitigation Suggestions */}
        {riskData.mitigationSuggestions.length > 0 && (
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <p className="text-xs font-medium">{t('mitigation_suggestions')}</p>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {riskData.mitigationSuggestions.map((suggestionKey, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>{t(suggestionKey)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Last Verification Info */}
        {lastVerifiedAt && (
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-1">{t('last_verification')}</p>
            <p className="text-sm font-medium">
              {formatDistanceToNow(new Date(lastVerifiedAt), {
                addSuffix: true,
                locale: getDateLocale(),
              })}
            </p>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground pt-2 border-t border-border">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-chart-2"></div>
            <span>{t('risk_low')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-chart-3"></div>
            <span>{t('risk_medium')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-warning"></div>
            <span>{t('risk_high')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-destructive"></div>
            <span>{t('risk_critical')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
