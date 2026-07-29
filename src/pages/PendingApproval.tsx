import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, ShieldX, LogOut, RefreshCw, Loader2, Mail } from "lucide-react";

/**
 * Ecrã mostrado ao utilizador cuja conta está a aguardar aprovação (fase
 * experimental) ou foi recusada. Substitui a app enquanto o gate estiver ativo.
 */
export default function PendingApproval() {
  const navigate = useNavigate();
  const { approvalStatus, rejectionReason, refreshApproval } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const rejected = approvalStatus === "rejected";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshApproval();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            {rejected ? (
              <ShieldX className="h-8 w-8 text-destructive" />
            ) : (
              <Clock className="h-8 w-8 text-primary" />
            )}
          </div>
          <CardTitle className="text-xl">
            {rejected ? "Acesso não aprovado" : "Conta em análise"}
          </CardTitle>
          <CardDescription className="mt-2">
            {rejected
              ? "O teu pedido de acesso ao AFROLOC não foi aprovado nesta fase."
              : "O AFROLOC está em fase experimental. O teu registo foi recebido e está a aguardar aprovação da nossa equipa."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {rejected && rejectionReason && (
            <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3">
              <span className="font-medium">Motivo:</span> {rejectionReason}
            </div>
          )}

          {!rejected && (
            <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground space-y-2">
              <p>
                Assim que a tua conta for aprovada, poderás entrar normalmente e
                criar o teu endereço AFROLOC. Não precisas de fazer mais nada.
              </p>
              <p>
                Este passo existe apenas durante a fase experimental, para
                garantirmos a qualidade dos primeiros endereços.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            {!rejected && (
              <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Verificar de novo
              </Button>
            )}
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Terminar sessão
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2 border-t">
            <Mail className="h-3 w-3" />
            <span>Dúvidas? Contacta-nos em afrofintek@gmail.com</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
