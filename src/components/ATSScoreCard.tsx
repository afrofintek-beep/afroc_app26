import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield, MapPin, Radio, Camera, Users, FileCheck, Info, Award } from "lucide-react";
import { 
  ATSScoreBreakdown, 
  ATSScoreInput, 
  calculateATSScore, 
  getCertificationLevel,
  getATSScoreColor,
  getATSProgressColor
} from "@/utils/atsScore";
import { useLanguage } from "@/contexts/LanguageContext";

interface ATSScoreCardProps {
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
  totalWitnesses: number;
  confirmedWitnesses: number;
  validatedWitnesses?: number;
  averageWitnessReputation?: number;
  
  // Documents
  totalDocuments: number;
  verifiedDocuments: number;
  
  // Address
  hasStreetAddress?: boolean;
  hasHouseNumber?: boolean;
  hasOfficialValidation?: boolean;
  
  className?: string;
}

export function ATSScoreCard({
  hasGpsCoordinates,
  geoLat,
  geoLon,
  hasGpsValidation = false,
  photoExifGpsLat,
  photoExifGpsLon,
  photoExifDeviceMake,
  photoExifDeviceModel,
  totalWitnesses,
  confirmedWitnesses,
  validatedWitnesses = 0,
  averageWitnessReputation = 50,
  totalDocuments,
  verifiedDocuments,
  hasStreetAddress = false,
  hasHouseNumber = false,
  hasOfficialValidation = false,
  className = ""
}: ATSScoreCardProps) {
  const { t } = useLanguage();
  const atsData = useMemo(() => {
    // Check if EXIF GPS matches device GPS (within ~100m tolerance)
    let gpsExifMatch: boolean | undefined;
    if (geoLat && geoLon && photoExifGpsLat && photoExifGpsLon) {
      const latDiff = Math.abs(geoLat - photoExifGpsLat);
      const lonDiff = Math.abs(geoLon - photoExifGpsLon);
      // Approximately 0.001 degrees = 111 meters
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
      validatedWitnesses,
      averageWitnessReputation,
      hasDocuments: totalDocuments > 0,
      verifiedDocuments,
      hasOfficialValidation,
      hasStreetAddress,
      hasHouseNumber
    };

    const breakdown = calculateATSScore(input);
    const certification = getCertificationLevel(breakdown.total);

    return { breakdown, certification, input };
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
    validatedWitnesses,
    averageWitnessReputation,
    totalDocuments,
    verifiedDocuments,
    hasOfficialValidation,
    hasStreetAddress,
    hasHouseNumber
  ]);

  const { breakdown, certification } = atsData;

  const scoreCategories = [
    {
      name: t('ats_category_gps'),
      score: breakdown.gps,
      max: 25,
      icon: MapPin,
      description: t('ats_category_gps_description')
    },
    {
      name: t('ats_category_telecom'),
      score: breakdown.telecom,
      max: 25,
      icon: Radio,
      description: t('ats_category_telecom_description')
    },
    {
      name: t('ats_category_exif'),
      score: breakdown.exif,
      max: 20,
      icon: Camera,
      description: t('ats_category_exif_description')
    },
    {
      name: t('ats_category_witness'),
      score: breakdown.witness,
      max: 15,
      icon: Users,
      description: `${t('ats_category_witness_description')} (${t('witness_reputation')}: ${averageWitnessReputation.toFixed(0)}%)`
    },
    {
      name: t('ats_category_audit'),
      score: breakdown.audit,
      max: 15,
      icon: FileCheck,
      description: t('ats_category_audit_description')
    }
  ];

  return (
    <Card className={`${className} ${certification.borderColor}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t('ats_title')}</CardTitle>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  {t('ats_tooltip_description')}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>{t('ats_subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Score Display */}
        <div className={`p-4 rounded-lg ${certification.bgColor}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Award className={`h-6 w-6 ${certification.color}`} />
              <span className={`text-3xl font-bold ${getATSScoreColor(breakdown.total)}`}>
                {breakdown.total}
              </span>
              <span className="text-muted-foreground">/100</span>
            </div>
            <Badge className={`${certification.bgColor} ${certification.color} border ${certification.borderColor}`}>
              Level {certification.level}
            </Badge>
          </div>
          <div className="space-y-1">
            <Progress 
              value={breakdown.total} 
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>20</span>
              <span>40</span>
              <span>60</span>
              <span>80</span>
              <span>100</span>
            </div>
          </div>
          <p className={`text-sm mt-2 font-medium ${certification.color}`}>
            {certification.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {certification.description}
          </p>
        </div>

        {/* Score Breakdown */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">{t('ats_score_breakdown')}</p>
          {scoreCategories.map((category) => {
            const percentage = (category.score / category.max) * 100;
            const Icon = category.icon;
            
            return (
              <TooltipProvider key={category.name}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span>{category.name}</span>
                        </div>
                        <span className="font-medium">
                          {category.score}/{category.max}
                        </span>
                      </div>
                      <Progress 
                        value={percentage} 
                        className="h-1.5"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">{category.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {/* Certification Level Scale */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">{t('ats_certification_levels')}</p>
          <div className="flex gap-1 text-xs">
            <div className="flex-1 text-center p-1 rounded bg-gray-100 dark:bg-gray-800">
              <div className="font-medium">0</div>
              <div className="text-muted-foreground text-[10px]">0-19</div>
            </div>
            <div className="flex-1 text-center p-1 rounded bg-green-100 dark:bg-green-900">
              <div className="font-medium text-green-700 dark:text-green-300">1</div>
              <div className="text-muted-foreground text-[10px]">20-39</div>
            </div>
            <div className="flex-1 text-center p-1 rounded bg-blue-100 dark:bg-blue-900">
              <div className="font-medium text-blue-700 dark:text-blue-300">2</div>
              <div className="text-muted-foreground text-[10px]">40-59</div>
            </div>
            <div className="flex-1 text-center p-1 rounded bg-purple-100 dark:bg-purple-900">
              <div className="font-medium text-purple-700 dark:text-purple-300">3</div>
              <div className="text-muted-foreground text-[10px]">60-79</div>
            </div>
            <div className="flex-1 text-center p-1 rounded bg-amber-100 dark:bg-amber-900">
              <div className="font-medium text-amber-700 dark:text-amber-300">4</div>
              <div className="text-muted-foreground text-[10px]">80+</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
