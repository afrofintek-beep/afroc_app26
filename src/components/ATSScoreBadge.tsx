import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield } from "lucide-react";
import { 
  ATSScoreInput, 
  calculateATSScore, 
  getCertificationLevel 
} from "@/utils/atsScore";
import { useLanguage } from "@/contexts/LanguageContext";

interface ATSScoreBadgeProps {
  // GPS data
  hasGpsCoordinates: boolean;
  geoLat?: number | null;
  geoLon?: number | null;
  hasGpsValidation?: boolean;
  
  // EXIF data
  photoExifGpsLat?: number | null;
  photoExifGpsLon?: number | null;
  photoExifDeviceMake?: string | null;
  photoExifDeviceModel?: string | null;
  
  // Witnesses
  totalWitnesses?: number;
  confirmedWitnesses?: number;
  
  // Documents
  totalDocuments?: number;
  verifiedDocuments?: number;
  
  // Address
  hasStreetAddress?: boolean;
  hasHouseNumber?: boolean;
  hasOfficialValidation?: boolean;
  
  size?: "sm" | "md" | "lg";
  showScore?: boolean;
  onClick?: () => void;
}

export function ATSScoreBadge({
  hasGpsCoordinates,
  geoLat,
  geoLon,
  hasGpsValidation = false,
  photoExifGpsLat,
  photoExifGpsLon,
  photoExifDeviceMake,
  photoExifDeviceModel,
  totalWitnesses = 0,
  confirmedWitnesses = 0,
  totalDocuments = 0,
  verifiedDocuments = 0,
  hasStreetAddress = false,
  hasHouseNumber = false,
  hasOfficialValidation = false,
  size = "md",
  showScore = true,
  onClick
}: ATSScoreBadgeProps) {
  const { t } = useLanguage();
  const atsData = useMemo(() => {
    // Check if EXIF GPS matches device GPS
    let gpsExifMatch: boolean | undefined;
    if (geoLat && geoLon && photoExifGpsLat && photoExifGpsLon) {
      const latDiff = Math.abs(geoLat - photoExifGpsLat);
      const lonDiff = Math.abs(geoLon - photoExifGpsLon);
      gpsExifMatch = latDiff < 0.001 && lonDiff < 0.001;
    }

    const input: ATSScoreInput = {
      hasGpsCoordinates,
      hasGpsValidation,
      hasExifData: !!(photoExifDeviceMake || photoExifDeviceModel || photoExifGpsLat),
      hasExifGps: !!(photoExifGpsLat && photoExifGpsLon),
      hasDeviceInfo: !!(photoExifDeviceMake || photoExifDeviceModel),
      gpsExifMatch,
      totalWitnesses,
      confirmedWitnesses,
      hasDocuments: totalDocuments > 0,
      verifiedDocuments,
      hasOfficialValidation,
      hasStreetAddress,
      hasHouseNumber
    };

    const breakdown = calculateATSScore(input);
    const certification = getCertificationLevel(breakdown.total);

    return { breakdown, certification };
  }, [
    hasGpsCoordinates,
    geoLat,
    geoLon,
    hasGpsValidation,
    photoExifGpsLat,
    photoExifGpsLon,
    photoExifDeviceMake,
    photoExifDeviceModel,
    totalWitnesses,
    confirmedWitnesses,
    totalDocuments,
    verifiedDocuments,
    hasOfficialValidation,
    hasStreetAddress,
    hasHouseNumber
  ]);

  const { breakdown, certification } = atsData;

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
            {showScore && <span className="font-bold">{breakdown.total}</span>}
            <span className="font-normal">L{certification.level}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{t('ats_title')}: {breakdown.total}/100</p>
            <p className="text-sm text-muted-foreground">{certification.name}</p>
            <div className="text-xs space-y-0.5 pt-1 border-t">
              <p>{t('ats_category_gps')}: {breakdown.gps}/25</p>
              <p>{t('ats_category_telecom')}: {breakdown.telecom}/25</p>
              <p>{t('ats_category_exif')}: {breakdown.exif}/20</p>
              <p>{t('ats_category_witness')}: {breakdown.witness}/15</p>
              <p>{t('ats_category_audit')}: {breakdown.audit}/15</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
