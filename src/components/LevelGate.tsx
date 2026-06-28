import { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { useAuthorizationLevel, LEVEL_NAMES, hasMinimumLevel } from "@/hooks/useAuthorizationLevel";
import { AuthorizationLevelBadge } from "./AuthorizationLevelBadge";

interface LevelGateProps {
  children: ReactNode;
  requiredLevel: number;
  fallback?: ReactNode;
  message?: string;
}

export const LevelGate = ({ 
  children, 
  requiredLevel, 
  fallback,
  message 
}: LevelGateProps) => {
  const { data: authLevel, isLoading } = useAuthorizationLevel();

  if (isLoading) {
    return <div className="animate-pulse bg-muted h-20 rounded-lg" />;
  }

  const userLevel = authLevel?.current_level || 1;
  const hasAccess = hasMinimumLevel(userLevel, requiredLevel);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const requiredLevelName = LEVEL_NAMES[requiredLevel as keyof typeof LEVEL_NAMES];

  return (
    <Alert variant="destructive" className="border-orange-200 bg-orange-50 dark:bg-orange-950">
      <Lock className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Level {requiredLevel} ({requiredLevelName}) Required
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          {message || `This feature requires Level ${requiredLevel} authorization or higher.`}
        </p>
        <p className="text-sm">
          Your current level: <AuthorizationLevelBadge level={userLevel} size="sm" />
        </p>
      </AlertDescription>
    </Alert>
  );
};
