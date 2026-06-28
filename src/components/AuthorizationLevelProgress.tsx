import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, ChevronRight, Building2 } from "lucide-react";
import { AuthorizationLevel, LEVEL_REQUIREMENTS } from "@/hooks/useAuthorizationLevel";
import { AuthorizationLevelBadge } from "./AuthorizationLevelBadge";

interface AuthorizationLevelProgressProps {
  authLevel: Partial<AuthorizationLevel>;
}

export const AuthorizationLevelProgress = ({ authLevel }: AuthorizationLevelProgressProps) => {
  const currentLevel = authLevel?.current_level || 1;
  const currentLevelInfo = LEVEL_REQUIREMENTS[currentLevel as keyof typeof LEVEL_REQUIREMENTS];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Nível de Autorização</CardTitle>
            <CardDescription>Cargo administrativo e jurisdição</CardDescription>
          </div>
          <AuthorizationLevelBadge level={currentLevel} size="lg" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Administrative Role */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Cargo Administrativo</p>
            </div>
            <p className="text-xl font-semibold">
              {authLevel.administrative_role || "Não atribuído"}
            </p>
          </div>

          {/* Level Description */}
          <div className="p-4 bg-card border rounded-lg">
            <p className="text-sm font-medium">{currentLevelInfo.name}</p>
            <p className="text-sm text-muted-foreground mt-1">{currentLevelInfo.description}</p>
          </div>

          {/* Responsibilities */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Responsabilidades</p>
            <ul className="space-y-2">
              {currentLevelInfo.requirements.map((req, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Jurisdiction Info */}
          {(authLevel.jurisdiction_country || authLevel.jurisdiction_level1_name) && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Jurisdição</p>
              <div className="grid gap-2 p-4 bg-muted/30 rounded-lg">
                {authLevel.jurisdiction_country && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      País: <strong>{authLevel.jurisdiction_country}</strong>
                    </span>
                  </div>
                )}
                {authLevel.jurisdiction_level1_name && (
                  <div className="flex items-center gap-2 ml-6">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{authLevel.jurisdiction_level1_name}</span>
                  </div>
                )}
                {authLevel.jurisdiction_level2_name && (
                  <div className="flex items-center gap-2 ml-12">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{authLevel.jurisdiction_level2_name}</span>
                  </div>
                )}
                {authLevel.jurisdiction_level3_name && (
                  <div className="flex items-center gap-2 ml-18">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{authLevel.jurisdiction_level3_name}</span>
                  </div>
                )}
                {authLevel.jurisdiction_level4_name && (
                  <div className="flex items-center gap-2 ml-24">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{authLevel.jurisdiction_level4_name}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
