import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  Home, 
  UserCheck, 
  Shield, 
  FileText, 
  AlertCircle,
  Loader2
} from "lucide-react";
import { ResidentRequestCard } from "./ResidentRequestCard";
import { AddResidentDialog } from "./AddResidentDialog";
import { ResidenceConfigDialog } from "./ResidenceConfigDialog";
import type { Database } from "@/integrations/supabase/types";

type ResidentStatus = Database["public"]["Enums"]["coresident_request_status"];
type ResidentRelationship = Database["public"]["Enums"]["resident_relationship"];
type ResidentDocumentType = Database["public"]["Enums"]["resident_document_type"];

interface RequiredDocuments {
  [key: string]: ResidentDocumentType[];
}

interface Resident {
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
}

interface ResidenceConfig {
  max_residents: number;
  required_documents: RequiredDocuments;
}

interface ResidentsTabProps {
  afrolocRecordId: string;
  afrolocCode: string;
  propertyType?: string | null;
  isOwner: boolean;
  currentUserId: string;
}

export function ResidentsTab({
  afrolocRecordId,
  afrolocCode,
  propertyType,
  isOwner,
  currentUserId,
}: ResidentsTabProps) {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [config, setConfig] = useState<ResidenceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  const loadResidents = async () => {
    try {
      // Carregar residentes
      const { data: residentsData, error: residentsError } = await supabase
        .from('afroloc_residents')
        .select('*')
        .eq('afroloc_record_id', afrolocRecordId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (residentsError) throw residentsError;

      // Carregar perfis e contagem de documentos para cada residente
      const residentsWithProfiles = await Promise.all(
        (residentsData || []).map(async (resident) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('id', resident.user_id)
            .maybeSingle();

          const { count: docsCount } = await supabase
            .from('afroloc_resident_documents')
            .select('*', { count: 'exact', head: true })
            .eq('resident_id', resident.id);

          return {
            ...resident,
            profile: profile || undefined,
            documents_count: docsCount || 0,
          };
        })
      );

      setResidents(residentsWithProfiles);

      // Carregar configuração da residência
      const { data: configData } = await supabase
        .from('afroloc_residence_config')
        .select('max_residents, required_documents')
        .eq('afroloc_record_id', afrolocRecordId)
        .maybeSingle();

      if (configData) {
        setConfig({
          max_residents: configData.max_residents,
          required_documents: configData.required_documents as RequiredDocuments,
        });
      }

      // Verificar role do utilizador através da tabela user_roles
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUserId)
        .maybeSingle();

      setUserRole(userRoleData?.role || null);
    } catch (error: any) {
      console.error('Error loading residents:', error);
      toast({
        title: t('error') || 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResidents();
  }, [afrolocRecordId]);

  const handleApprove = async (residentId: string) => {
    try {
      const resident = residents.find(r => r.id === residentId);
      if (!resident) return;

      const isAuthority = userRole === 'admin' || userRole === 'operator_field';
      const isPrimaryApproval = resident.status === 'pending_primary';
      const isAuthorityApproval = resident.status === 'pending_authority';

      let updateData: Record<string, any> = { updated_at: new Date().toISOString() };

      if (isPrimaryApproval && isOwner) {
        updateData.primary_approved_at = new Date().toISOString();
        updateData.primary_approved_by_user_id = currentUserId;
        updateData.status = 'pending_authority'; // Próximo passo: autoridade
      } else if (isAuthorityApproval && isAuthority) {
        updateData.authority_approved_at = new Date().toISOString();
        updateData.authority_approved_by_user_id = currentUserId;
        updateData.authority_role = userRole;
        updateData.status = 'approved';
        updateData.valid_from = new Date().toISOString();
      }

      const { error } = await supabase
        .from('afroloc_residents')
        .update(updateData)
        .eq('id', residentId);

      if (error) throw error;

      toast({
        title: t('approval_success') || 'Aprovado',
        description: t('resident_approved') || 'Residente aprovado com sucesso',
      });

      loadResidents();
    } catch (error: any) {
      toast({
        title: t('error') || 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (residentId: string) => {
    try {
      const { error } = await supabase
        .from('afroloc_residents')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_by_user_id: currentUserId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', residentId);

      if (error) throw error;

      toast({
        title: t('rejection_success') || 'Rejeitado',
        description: t('resident_rejected') || 'Pedido rejeitado',
      });

      loadResidents();
    } catch (error: any) {
      toast({
        title: t('error') || 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const approvedResidents = residents.filter(r => r.status === 'approved').length;
  const pendingResidents = residents.filter(r => 
    ['pending_primary', 'pending_documents', 'pending_authority'].includes(r.status)
  ).length;
  const maxResidents = config?.max_residents || 5;
  const occupancyRate = (approvedResidents / maxResidents) * 100;
  const isAuthority = userRole === 'admin' || userRole === 'operator_field';

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvedResidents}/{maxResidents}</p>
                <p className="text-xs text-muted-foreground">{t('approved_residents') || 'Residentes Aprovados'}</p>
              </div>
            </div>
            <Progress value={occupancyRate} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingResidents}</p>
                <p className="text-xs text-muted-foreground">{t('pending_requests') || 'Pedidos Pendentes'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {residents.filter(r => r.authority_approved_at).length}
                </p>
                <p className="text-xs text-muted-foreground">{t('authority_certified') || 'Certificados'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações do proprietário */}
      {isOwner && (
        <div className="flex flex-wrap gap-2">
          <AddResidentDialog
            afrolocRecordId={afrolocRecordId}
            afrolocCode={afrolocCode}
            maxResidents={maxResidents}
            currentResidents={approvedResidents}
            onResidentAdded={loadResidents}
          />
          <ResidenceConfigDialog
            afrolocRecordId={afrolocRecordId}
            afrolocCode={afrolocCode}
            propertyType={propertyType}
            currentConfig={config}
            onConfigUpdated={loadResidents}
          />
        </div>
      )}

      {/* Lista de residentes */}
      {residents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Home className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-2">
              {t('no_residents_yet') || 'Nenhum Residente Registado'}
            </h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              {isOwner 
                ? (t('add_first_resident') || 'Adicione residentes para partilhar este endereço AFROLOC')
                : (t('no_residents_registered') || 'Este endereço ainda não tem co-residentes registados')
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {residents.map((resident) => (
            <ResidentRequestCard
              key={resident.id}
              resident={resident}
              onApprove={handleApprove}
              onReject={handleReject}
              isPrimaryOwner={isOwner}
              isAuthority={isAuthority}
            />
          ))}
        </div>
      )}

      {/* Informação sobre o fluxo de validação */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('validation_flow') || 'Fluxo de Validação'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full h-6 w-6 p-0 justify-center">1</Badge>
              <span>{t('step_documents') || 'Documentos'}</span>
            </div>
            <div className="hidden sm:block text-muted-foreground">→</div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full h-6 w-6 p-0 justify-center">2</Badge>
              <span>{t('step_primary_approval') || 'Aprovação Principal'}</span>
            </div>
            <div className="hidden sm:block text-muted-foreground">→</div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full h-6 w-6 p-0 justify-center">3</Badge>
              <span>{t('step_authority') || 'Certificação Autoridade'}</span>
            </div>
            <div className="hidden sm:block text-muted-foreground">→</div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="rounded-full h-6 w-6 p-0 justify-center">
                <UserCheck className="h-3 w-3" />
              </Badge>
              <span>{t('step_approved') || 'Aprovado'}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
