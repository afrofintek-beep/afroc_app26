import { useAuth } from "@/contexts/AuthContext";
import PendingApproval from "@/pages/PendingApproval";

/**
 * Gate global da FASE EXPERIMENTAL. Um utilizador autenticado cujo registo
 * ainda não foi aprovado (ou foi recusado) vê o ecrã de espera em vez da app.
 *
 * Não bloqueia:
 *  - visitantes não autenticados (as páginas tratam do redirect para /login);
 *  - admins/autoridades (isPrivileged) — precisam de entrar para aprovar outros;
 *  - contas 'approved' (o caso normal, e o de toda a base existente).
 */
export function ApprovalGate({ children }: { children: React.ReactNode }) {
  const { user, approvalStatus, isPrivileged } = useAuth();

  const blocked =
    !!user &&
    !isPrivileged &&
    (approvalStatus === "pending" || approvalStatus === "rejected");

  if (blocked) {
    return <PendingApproval />;
  }

  return <>{children}</>;
}
