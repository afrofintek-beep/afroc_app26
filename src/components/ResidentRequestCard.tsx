import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  User, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  AlertCircle,
  Home,
  UserCheck,
  Shield
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type ResidentStatus = Database["public"]["Enums"]["coresident_request_status"];
type ResidentRelationship = Database["public"]["Enums"]["resident_relationship"];

interface ResidentRequestCardProps {
  resident: {
    id: string;
    user_id: string;
    relationship: ResidentRelationship;
    status: ResidentStatus;
    is_primary: boolean;
    created_at: string;
    valid_from?: string | null;
    valid_until?: string | null;
    primary_approved_at?: string | null;
    authority_approved_at?: string | null;
    rejection_reason?: string | null;
    profile?: {
      full_name?: string;
      phone?: string;
    };
    documents_count?: number;
  };
  onApprove?: (residentId: string) => void;
  onReject?: (residentId: string) => void;
  onViewDocuments?: (residentId: string) => void;
  isPrimaryOwner?: boolean;
  isAuthority?: boolean;
}

export function ResidentRequestCard({
  resident,
  onApprove,
  onReject,
  onViewDocuments,
  isPrimaryOwner = false,
  isAuthority = false,
}: ResidentRequestCardProps) {
  const { t } = useLanguage();

  const getRelationshipLabel = (relationship: ResidentRelationship) => {
    const labels: Record<ResidentRelationship, string> = {
      owner: t('relationship_owner') || 'Proprietário',
      tenant: t('relationship_tenant') || 'Inquilino',
      spouse: t('relationship_spouse') || 'Cônjuge',
      child: t('relationship_child') || 'Filho/a',
      parent: t('relationship_parent') || 'Pai/Mãe',
      sibling: t('relationship_sibling') || 'Irmão/Irmã',
      other_family: t('relationship_other_family') || 'Outro Familiar',
      cohabitant: t('relationship_cohabitant') || 'Coabitante',
    };
    return labels[relationship] || relationship;
  };

  const getStatusInfo = (status: ResidentStatus) => {
    // NOTE: Be defensive here — if backend enum values evolve (or legacy rows contain
    // unexpected values), we must not crash the UI.
    const statusMap: Partial<Record<ResidentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }>> = {
      pending_primary: {
        label: t('status_pending_primary') || 'Aguarda Aprovação',
        variant: 'outline',
        icon: <Clock className="h-3 w-3" />,
      },
      pending_documents: {
        label: t('status_pending_documents') || 'Documentos Pendentes',
        variant: 'secondary',
        icon: <FileText className="h-3 w-3" />,
      },
      pending_authority: {
        label: t('status_pending_authority') || 'Aguarda Autoridade',
        variant: 'outline',
        icon: <Shield className="h-3 w-3" />,
      },
      approved: {
        label: t('status_approved') || 'Aprovado',
        variant: 'default',
        icon: <CheckCircle2 className="h-3 w-3" />,
      },
      rejected: {
        label: t('status_rejected') || 'Rejeitado',
        variant: 'destructive',
        icon: <XCircle className="h-3 w-3" />,
      },
      expired: {
        label: t('status_expired') || 'Expirado',
        variant: 'destructive',
        icon: <AlertCircle className="h-3 w-3" />,
      },
      revoked: {
        label: t('status_revoked') || 'Revogado',
        variant: 'destructive',
        icon: <XCircle className="h-3 w-3" />,
      },
    };

    return (
      statusMap[status] ?? {
        label: String(status),
        variant: 'outline',
        icon: <Clock className="h-3 w-3" />,
      }
    );
  };

  const statusInfo = getStatusInfo(resident.status);
  const canPrimaryApprove = isPrimaryOwner && resident.status === 'pending_primary';
  const canAuthorityApprove = isAuthority && resident.status === 'pending_authority';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              {resident.is_primary ? (
                <Home className="h-5 w-5 text-primary" />
              ) : (
                <User className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <CardTitle className="text-base">
                {resident.profile?.full_name || t('anonymous_user') || 'Utilizador'}
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <span>{getRelationshipLabel(resident.relationship)}</span>
                {resident.is_primary && (
                  <Badge variant="secondary" className="text-xs">
                    <Home className="h-3 w-3 mr-1" />
                    {t('primary_resident') || 'Principal'}
                  </Badge>
                )}
              </CardDescription>
            </div>
          </div>
          <Badge 
            variant={statusInfo.variant}
            className="flex items-center gap-1"
          >
            {statusInfo.icon}
            {statusInfo.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Timeline de validação */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{new Date(resident.created_at).toLocaleDateString()}</span>
          </div>
          {resident.primary_approved_at && (
            <div className="flex items-center gap-1 text-primary">
              <UserCheck className="h-3 w-3" />
              <span>{t('primary_approved') || 'Aprovado'}</span>
            </div>
          )}
          {resident.authority_approved_at && (
            <div className="flex items-center gap-1 text-primary">
              <Shield className="h-3 w-3" />
              <span>{t('authority_certified') || 'Certificado'}</span>
            </div>
          )}
        </div>

        {/* Validade */}
        {resident.valid_until && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">{t('valid_until') || 'Válido até'}:</span>{' '}
            {new Date(resident.valid_until).toLocaleDateString()}
          </div>
        )}

        {/* Documentos */}
        {resident.documents_count !== undefined && (
          <div className="flex items-center gap-2 text-xs">
            <FileText className="h-3 w-3" />
            <span>
              {resident.documents_count} {t('documents_submitted') || 'documento(s)'}
            </span>
            {onViewDocuments && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => onViewDocuments(resident.id)}
              >
                {t('view') || 'Ver'}
              </Button>
            )}
          </div>
        )}

        {/* Razão de rejeição */}
        {resident.rejection_reason && (
          <div className="p-2 rounded-md bg-destructive/10 text-destructive text-xs">
            <span className="font-medium">{t('rejection_reason') || 'Motivo'}:</span>{' '}
            {resident.rejection_reason}
          </div>
        )}

        {/* Ações */}
        {(canPrimaryApprove || canAuthorityApprove) && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onApprove?.(resident.id)}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {t('approve') || 'Aprovar'}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={() => onReject?.(resident.id)}
            >
              <XCircle className="h-4 w-4 mr-1" />
              {t('reject') || 'Rejeitar'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
