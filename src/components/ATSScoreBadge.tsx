import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield } from "lucide-react";
import {
  ATSScoreBreakdown,
  getCertificationLevelByLevel
} from "@/utils/atsScore";
import { useLanguage } from "@/contexts/LanguageContext";

interface ATSScoreBadgeProps {
  /** Server-provided ATS score (0-100). Null = pending/not yet scored. */
  atsScore?: number | null;
  /** Server-provided certification level (0-4). Null defaults to level 0. */
  certificationLevel?: number | null;
  /** Server-provided score breakdown (jsonb). Optional. */
  breakdown?: ATSScoreBreakdown | unknown | null;

  size?: "sm" | "md" | "lg";
  showScore?: boolean;
  onClick?: () => void;
}

export function ATSScoreBadge({
  atsScore,
  certificationLevel,
  breakdown: breakdownRaw,
  size = "md",
  showScore = true,
  onClick
}: ATSScoreBadgeProps) {
  const { t } = useLanguage();

  const breakdown = (breakdownRaw ?? null) as ATSScoreBreakdown | null;
  const isPending = atsScore == null;
  const level = (certificationLevel ?? 0) as 0 | 1 | 2 | 3 | 4;
  const certification = getCertificationLevelByLevel(level);
  const total = atsScore ?? 0;

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base px-3 py-1.5"
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${sizeClasses[size]} ${certification.bgColor} ${certification.color} border ${certification.borderColor} flex items-center gap-1.5 font-medium ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={onClick}
          >
            <Shield className={iconSizes[size]} />
            {showScore && <span className="font-bold">{isPending ? '—' : total}</span>}
            <span className="font-normal">L{certification.level}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{t('ats_title')}: {isPending ? '—' : total}/100</p>
            <p className="text-sm text-muted-foreground">{certification.name}</p>
            {breakdown && (
              <div className="text-xs space-y-0.5 pt-1 border-t">
                <p>{t('ats_category_gps')}: {breakdown.gps}/25</p>
                <p>{t('ats_category_telecom')}: {breakdown.telecom}/25</p>
                <p>{t('ats_category_exif')}: {breakdown.exif}/20</p>
                <p>{t('ats_category_witness')}: {breakdown.witness}/15</p>
                <p>{t('ats_category_audit')}: {breakdown.audit}/15</p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
