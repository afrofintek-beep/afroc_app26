import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield, MapPin, Radio, Camera, Users, FileCheck, Info, Award } from "lucide-react";
import {
  ATSScoreBreakdown,
  getCertificationLevelByLevel,
  getATSScoreColor
} from "@/utils/atsScore";
import { useLanguage } from "@/contexts/LanguageContext";

interface ATSScoreCardProps {
  /** Server-provided ATS score (0-100). Null = pending/not yet scored. */
  atsScore?: number | null;
  /** Server-provided certification level (0-4). Null defaults to level 0. */
  certificationLevel?: number | null;
  /** Server-provided score breakdown (jsonb). Null = pending. */
  breakdown?: ATSScoreBreakdown | unknown | null;

  className?: string;
}

export function ATSScoreCard({
  atsScore,
  certificationLevel,
  breakdown: breakdownRaw,
  className = ""
}: ATSScoreCardProps) {
  const { t } = useLanguage();

  const breakdown = (breakdownRaw ?? null) as ATSScoreBreakdown | null;
  const isPending = atsScore == null;
  const level = (certificationLevel ?? 0) as 0 | 1 | 2 | 3 | 4;
  const certification = getCertificationLevelByLevel(level);
  const total = atsScore ?? 0;

  const scoreCategories = [
    {
      name: t('ats_category_gps'),
      score: breakdown?.gps ?? 0,
      max: 25,
      icon: MapPin,
      description: t('ats_category_gps_description')
    },
    {
      name: t('ats_category_telecom'),
      score: breakdown?.telecom ?? 0,
      max: 25,
      icon: Radio,
      description: t('ats_category_telecom_description')
    },
    {
      name: t('ats_category_exif'),
      score: breakdown?.exif ?? 0,
      max: 20,
      icon: Camera,
      description: t('ats_category_exif_description')
    },
    {
      name: t('ats_category_witness'),
      score: breakdown?.witness ?? 0,
      max: 15,
      icon: Users,
      description: t('ats_category_witness_description')
    },
    {
      name: t('ats_category_audit'),
      score: breakdown?.audit ?? 0,
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
              <span className={`text-3xl font-bold ${getATSScoreColor(total)}`}>
                {isPending ? '—' : total}
              </span>
              <span className="text-muted-foreground">/100</span>
            </div>
            <Badge className={`${certification.bgColor} ${certification.color} border ${certification.borderColor}`}>
              Level {certification.level}
            </Badge>
          </div>
          <div className="space-y-1">
            <Progress
              value={total}
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
            </div>
            <div className="flex-1 text-center p-1 rounded bg-green-100 dark:bg-green-900">
              <div className="font-medium text-green-700 dark:text-green-300">1</div>
            </div>
            <div className="flex-1 text-center p-1 rounded bg-blue-100 dark:bg-blue-900">
              <div className="font-medium text-blue-700 dark:text-blue-300">2</div>
            </div>
            <div className="flex-1 text-center p-1 rounded bg-purple-100 dark:bg-purple-900">
              <div className="font-medium text-purple-700 dark:text-purple-300">3</div>
            </div>
            <div className="flex-1 text-center p-1 rounded bg-amber-100 dark:bg-amber-900">
              <div className="font-medium text-amber-700 dark:text-amber-300">4</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
