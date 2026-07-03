/**
 * PublicValidationStatus Component
 * 
 * A simplified validation status display for public-facing views.
 * Hides all technical details (GPS coordinates, spoofing scores, etc.)
 * and shows only generic success/failure messages for security and copyright reasons.
 */

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Phone } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface PublicValidationStatusProps {
  /**
   * Server-authoritative validation flag (record.gps_verified). When omitted,
   * defaults to false (not yet verified). The client no longer runs spoofing
   * detection — the verdict comes from the server.
   */
  isValidated?: boolean | null;
  className?: string;
  /** Contact information to display when validation fails */
  contactInfo?: string;
}

export function PublicValidationStatus({
  isValidated: isValidatedProp,
  className = "",
  contactInfo
}: PublicValidationStatusProps) {
  const { t } = useLanguage();

  const isValidated = isValidatedProp ?? false;

  if (isValidated) {
    return (
      <Card className={`border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 ${className}`}>
        <CardContent className="pt-6">
          <Alert className="border-0 bg-transparent p-0">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <AlertTitle className="text-green-700 dark:text-green-300 font-semibold">
              {t('public_validation_complete')}
            </AlertTitle>
            <AlertDescription className="text-green-600 dark:text-green-400 mt-1">
              {t('public_address_confirmed')}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 ${className}`}>
      <CardContent className="pt-6">
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
      </CardContent>
    </Card>
  );
}
