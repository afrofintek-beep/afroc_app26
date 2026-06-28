import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateVerificationRisk, shouldShowVerificationCycle, type AddressRiskInput } from "@/utils/verificationRisk";
import { useLanguage } from "@/contexts/LanguageContext";

interface VerificationStatusBarProps {
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
  
  // Display options
  className?: string;
  showLabel?: boolean;
}

export const VerificationStatusBar = ({
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
  className,
  showLabel = true,
}: VerificationStatusBarProps) => {
  const { t } = useLanguage();
  
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
        return XCircle;
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
  
  const Icon = getStatusIcon();
  
  const getBarColorClass = () => {
    switch (riskData.status) {
      case 'overdue':
      case 'urgent':
        return 'bg-destructive';
      case 'upcoming':
        return 'bg-warning';
      default:
        return 'bg-chart-2';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("space-y-2", className)}>
            {showLabel && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="font-medium">{getTranslatedStatusLabel()}</span>
                </div>
                <span 
                  className="font-semibold"
                  style={{ color: riskData.riskColor }}
                >
                  {getTranslatedRiskLabel()}
                </span>
              </div>
            )}
            
            {/* Colored status bar */}
            <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500 relative",
                  getBarColorClass()
                )}
                style={{ width: `${riskData.cycleProgress}%` }}
              >
                {/* Shimmer effect for urgent/overdue status */}
                {(riskData.status === 'urgent' || riskData.status === 'overdue') && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                )}
              </div>
              
              {/* Percentage text overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-foreground/80 mix-blend-difference">
                  {Math.round(riskData.cycleProgress)}%
                </span>
              </div>
            </div>
            
            {/* Frequency indicator */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                {t('times_per_year').replace('{count}', String(riskData.verificationsPerYear))} ({t('months_duration').replace('{months}', String(riskData.cycleDurationMonths))})
              </span>
              <span>
                {t('cycle')} {riskData.currentCycle}/{riskData.verificationsPerYear}
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2 text-xs">
            <div className="font-semibold">{t('verification_cycle')}</div>
            
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('risk_level')}:</span>
                <span className="font-medium" style={{ color: riskData.riskColor }}>
                  {getTranslatedRiskLabel()} ({riskData.riskScore}/100)
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('frequency')}:</span>
                <span className="font-medium">
                  {t('verifications_per_year').replace('{count}', String(riskData.verificationsPerYear))}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('cycle')}:</span>
                <span className="font-medium">
                  {t('months_days').replace('{months}', String(riskData.cycleDurationMonths)).replace('{days}', String(riskData.cycleDurationDays))}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('progress')}:</span>
                <span className="font-medium">{Math.round(riskData.cycleProgress)}%</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('days_remaining')}:</span>
                <span className="font-medium">{riskData.daysRemaining} {t('days')}</span>
              </div>
            </div>
            
            {/* Risk breakdown */}
            <div className="pt-2 border-t border-border">
              <p className="font-medium mb-1">{t('risk_factors')}:</p>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <span>{t('completeness')}: {riskData.riskBreakdown.addressCompleteness}/20</span>
                <span>{t('property')}: {riskData.riskBreakdown.propertyStability}/15</span>
                <span>GPS: {riskData.riskBreakdown.gpsValidation}/15</span>
                <span>{t('witnesses')}: {riskData.riskBreakdown.witnessQuality}/15</span>
                <span>ATS: {riskData.riskBreakdown.atsScore}/20</span>
                <span>{t('history')}: {riskData.riskBreakdown.verificationHistory}/15</span>
              </div>
            </div>
            
            {riskData.mitigationSuggestions.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="font-medium mb-1">{t('suggestions')}:</p>
                <ul className="text-[10px] text-muted-foreground space-y-0.5">
                  {riskData.mitigationSuggestions.slice(0, 3).map((suggestionKey, i) => (
                    <li key={i}>• {t(suggestionKey)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
