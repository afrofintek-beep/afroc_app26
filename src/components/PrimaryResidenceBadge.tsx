import { Badge } from "@/components/ui/badge";
import { Home, Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface PrimaryResidenceBadgeProps {
  isPrimary: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  interactive?: boolean;
}

/**
 * PrimaryResidenceBadge displays whether an address is the user's
 * primary residence for official validation purposes.
 */
export function PrimaryResidenceBadge({ 
  isPrimary,
  size = "md",
  showLabel = true,
  onClick,
  interactive = false
}: PrimaryResidenceBadgeProps) {
  const { t } = useLanguage();
  
  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5 gap-1",
    md: "text-xs px-2.5 py-0.5 gap-1.5",
    lg: "text-sm px-3 py-1 gap-2"
  };
  
  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4"
  };

  if (!isPrimary && !interactive) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(e);
  };

  if (isPrimary) {
    return (
      <Badge 
        variant="default"
        className={`flex items-center flex-shrink-0 shadow-sm bg-zinc-500 hover:bg-zinc-600 text-white ${sizeClasses[size]} ${interactive ? 'cursor-pointer' : ''}`}
        onClick={handleClick}
      >
        <Star className={`${iconSizes[size]} fill-current`} />
        {showLabel && <span>{t("primary_residence")}</span>}
      </Badge>
    );
  }

  // Interactive mode - show "set as primary" option
  if (interactive) {
    return (
      <Badge 
        variant="outline"
        className={`flex items-center flex-shrink-0 border-dashed cursor-pointer hover:border-amber-500 hover:text-amber-600 transition-colors ${sizeClasses[size]}`}
        onClick={handleClick}
      >
        <Home className={iconSizes[size]} />
        {showLabel && <span>{t("set_as_primary_residence")}</span>}
      </Badge>
    );
  }

  return null;
}
