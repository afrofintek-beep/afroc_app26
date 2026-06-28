import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface AddressTypeBadgeProps {
  addressType: string | null | undefined;
  isCertified?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

/**
 * AddressTypeBadge displays the type of address:
 * - Formal: Address with street name and house number
 * - Informal: Address without official street name/number
 * - Digital: Only shown AFTER the address is certified by authorities
 *   (replaces Formal/Informal once certified)
 */
export function AddressTypeBadge({ 
  addressType, 
  isCertified = false,
  size = "md",
  showLabel = true 
}: AddressTypeBadgeProps) {
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

  // If certified, show "Digital" regardless of original type
  if (isCertified) {
    return (
      <Badge 
        variant="digital"
        className={`flex items-center flex-shrink-0 shadow-sm ${sizeClasses[size]}`}
      >
        <Globe className={iconSizes[size]} />
        {showLabel && <span>{t("address_type_digital")}</span>}
      </Badge>
    );
  }

  // Not certified: show Formal or Informal based on address_type
  const isFormal = addressType === "formal";

  return (
    <Badge 
      variant={isFormal ? "formal" : "informal"}
      className={`flex items-center flex-shrink-0 shadow-sm ${sizeClasses[size]}`}
    >
      {isFormal ? (
        <Building2 className={iconSizes[size]} />
      ) : (
        <MapPin className={iconSizes[size]} />
      )}
      {showLabel && (
        <span>{isFormal ? t("address_type_formal") : t("address_type_informal")}</span>
      )}
    </Badge>
  );
}
