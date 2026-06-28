import { Shield, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LEVEL_NAMES, LEVEL_REQUIREMENTS } from "@/hooks/useAuthorizationLevel";
import { cn } from "@/lib/utils";

interface AuthorizationLevelBadgeProps {
  level: number;
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
}

const LEVEL_VARIANTS = {
  1: "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300",
  2: "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300",
  3: "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300",
  4: "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300",
  5: "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-300"
} as const;

export const AuthorizationLevelBadge = ({ 
  level, 
  showTooltip = true,
  size = "md" 
}: AuthorizationLevelBadgeProps) => {
  const levelName = LEVEL_NAMES[level as keyof typeof LEVEL_NAMES] || "Unknown";
  const levelInfo = LEVEL_REQUIREMENTS[level as keyof typeof LEVEL_REQUIREMENTS];
  const variant = LEVEL_VARIANTS[level as keyof typeof LEVEL_VARIANTS] || LEVEL_VARIANTS[1];

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5"
  };

  const iconSize = {
    sm: 12,
    md: 14,
    lg: 16
  };

  const badge = (
    <Badge 
      className={cn(
        "gap-1.5 font-semibold transition-colors",
        variant,
        sizeClasses[size]
      )}
    >
      {level === 5 ? (
        <Shield className="h-4 w-4" size={iconSize[size]} />
      ) : (
        <Lock className="h-4 w-4" size={iconSize[size]} />
      )}
      Level {level}: {levelName}
    </Badge>
  );

  if (!showTooltip || !levelInfo) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold">{levelInfo.name}</p>
            <p className="text-sm text-muted-foreground">{levelInfo.description}</p>
            {levelInfo.requirements.length > 0 && (
              <div className="text-xs space-y-1">
                <p className="font-medium">Requirements:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {levelInfo.requirements.map((req, idx) => (
                    <li key={idx}>{req}</li>
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
