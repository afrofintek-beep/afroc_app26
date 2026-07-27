import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { ResidentDocumentUpload } from "./ResidentDocumentUpload";
import type { Database } from "@/integrations/supabase/types";

type ResidentRelationship = Database["public"]["Enums"]["resident_relationship"];
type ResidentDocumentType = Database["public"]["Enums"]["resident_document_type"];

interface ExistingDoc {
  id: string;
  document_type: ResidentDocumentType;
  status: string;
  file_name: string;
  expiry_date?: string | null;
}

interface ResidentDocumentsDialogProps {
  residentId: string;
  relationship: ResidentRelationship;
  residentName?: string;
  /** Documentos obrigatórios por relação, vindos da configuração da residência. */
  configuredDocuments?: ResidentDocumentType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

// Documentos obrigatórios por omissão quando a residência não tem configuração
// específica para a relação (incl. os novos 'father'/'mother').
const DEFAULT_REQUIRED: Record<string, ResidentDocumentType[]> = {
  owner: ['identity_card', 'property_deed'],
  tenant: ['identity_card', 'rental_contract'],
  spouse: ['identity_card', 'marriage_certificate'],
  child: ['identity_card', 'birth_certificate'],
  father: ['identity_card', 'birth_certificate'],
  mother: ['identity_card', 'birth_certificate'],
  parent: ['identity_card', 'birth_certificate'],
  sibling: ['identity_card', 'birth_certificate'],
  other_family: ['identity_card', 'residence_declaration'],
  cohabitant: ['identity_card', 'residence_declaration'],
};

export function ResidentDocumentsDialog({
  residentId,
  relationship,
  residentName,
  configuredDocuments,
  open,
  onOpenChange,
  onChanged,
}: ResidentDocumentsDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<ExistingDoc[]>([]);

  const requiredDocuments =
    (configuredDocuments && configuredDocuments.length > 0
      ? configuredDocuments
      : DEFAULT_REQUIRED[relationship]) || ['identity_card'];

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('afroloc_resident_documents')
        .select('id, document_type, status, file_name, expiry_date')
        .eq('resident_id', residentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocuments((data || []) as ExistingDoc[]);
    } catch (error: any) {
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
    if (open) loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, residentId]);

  const handleUploaded = () => {
    loadDocuments();
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('resident_documents_title') || 'Prova documental da relação'}
          </DialogTitle>
          <DialogDescription>
            {(t('resident_documents_desc') ||
              'Anexe os documentos que comprovam a relação de {name} com o titular. Enquanto a autoridade não validar, o co-residente fica pendente.').replace(
              '{name}',
              residentName || (t('this_resident') || 'este co-residente'),
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ResidentDocumentUpload
            residentId={residentId}
            requiredDocuments={requiredDocuments}
            existingDocuments={documents}
            onDocumentUploaded={handleUploaded}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
