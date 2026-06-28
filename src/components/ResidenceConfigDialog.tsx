import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Loader2, Home, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Database } from "@/integrations/supabase/types";

type ResidentDocumentType = Database["public"]["Enums"]["resident_document_type"];
type ResidentRelationship = Database["public"]["Enums"]["resident_relationship"];

interface RequiredDocuments {
  [key: string]: ResidentDocumentType[];
}

interface ResidenceConfigDialogProps {
  afrolocRecordId: string;
  afrolocCode: string;
  propertyType?: string | null;
  currentConfig?: {
    max_residents: number;
    required_documents: RequiredDocuments;
  } | null;
  onConfigUpdated: () => void;
}

export function ResidenceConfigDialog({
  afrolocRecordId,
  afrolocCode,
  propertyType,
  currentConfig,
  onConfigUpdated,
}: ResidenceConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [maxResidents, setMaxResidents] = useState(currentConfig?.max_residents || 5);
  const [requiredDocs, setRequiredDocs] = useState<RequiredDocuments>(
    currentConfig?.required_documents || {}
  );
  const { toast } = useToast();
  const { t } = useLanguage();

  const documentTypes: { value: ResidentDocumentType; label: string }[] = [
    { value: 'identity_card', label: t('doc_identity_card') || 'Bilhete de Identidade' },
    { value: 'passport', label: t('doc_passport') || 'Passaporte' },
    { value: 'birth_certificate', label: t('doc_birth_certificate') || 'Certidão de Nascimento' },
    { value: 'marriage_certificate', label: t('doc_marriage_certificate') || 'Certidão de Casamento' },
    { value: 'rental_contract', label: t('doc_rental_contract') || 'Contrato de Arrendamento' },
    { value: 'property_deed', label: t('doc_property_deed') || 'Escritura de Propriedade' },
    { value: 'residence_declaration', label: t('doc_residence_declaration') || 'Declaração de Residência' },
  ];

  const relationships: { value: ResidentRelationship; label: string; defaultDocs: ResidentDocumentType[] }[] = [
    { 
      value: 'spouse', 
      label: t('relationship_spouse') || 'Cônjuge',
      defaultDocs: ['identity_card', 'marriage_certificate']
    },
    { 
      value: 'child', 
      label: t('relationship_child') || 'Filho/a',
      defaultDocs: ['identity_card', 'birth_certificate']
    },
    { 
      value: 'parent', 
      label: t('relationship_parent') || 'Pai/Mãe',
      defaultDocs: ['identity_card']
    },
    { 
      value: 'sibling', 
      label: t('relationship_sibling') || 'Irmão/Irmã',
      defaultDocs: ['identity_card', 'birth_certificate']
    },
    { 
      value: 'other_family', 
      label: t('relationship_other_family') || 'Outro Familiar',
      defaultDocs: ['identity_card', 'residence_declaration']
    },
    { 
      value: 'tenant', 
      label: t('relationship_tenant') || 'Inquilino',
      defaultDocs: ['identity_card', 'rental_contract']
    },
    { 
      value: 'cohabitant', 
      label: t('relationship_cohabitant') || 'Coabitante',
      defaultDocs: ['identity_card', 'residence_declaration']
    },
  ];

  // Inicializar documentos obrigatórios com valores padrão
  useEffect(() => {
    if (Object.keys(requiredDocs).length === 0) {
      const defaultDocs: RequiredDocuments = {};
      relationships.forEach(rel => {
        defaultDocs[rel.value] = rel.defaultDocs;
      });
      setRequiredDocs(defaultDocs);
    }
  }, []);

  const toggleDocument = (relationship: ResidentRelationship, docType: ResidentDocumentType) => {
    setRequiredDocs(prev => {
      const currentDocs = prev[relationship] || [];
      const newDocs = currentDocs.includes(docType)
        ? currentDocs.filter(d => d !== docType)
        : [...currentDocs, docType];
      return { ...prev, [relationship]: newDocs };
    });
  };

  const handleSubmit = async () => {
    if (maxResidents < 1 || maxResidents > 20) {
      toast({
        title: t('validation_error') || 'Erro de Validação',
        description: t('invalid_max_residents') || 'O número máximo de residentes deve ser entre 1 e 20',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const configData = {
        afroloc_record_id: afrolocRecordId,
        max_residents: maxResidents,
        required_documents: requiredDocs,
        configured_by_user_id: session.user.id,
        configured_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('afroloc_residence_config')
        .upsert(configData, {
          onConflict: 'afroloc_record_id',
        });

      if (error) throw error;

      toast({
        title: t('config_saved') || 'Configuração Guardada',
        description: t('residence_config_updated') || 'A configuração da residência foi atualizada',
      });

      setOpen(false);
      onConfigUpdated();
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast({
        title: t('error') || 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          {t('configure_residence') || 'Configurar Residência'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            {t('residence_config') || 'Configuração da Residência'}
          </DialogTitle>
          <DialogDescription>
            {t('residence_config_desc') || 'Defina a capacidade e documentos obrigatórios para co-residentes.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Código AFROLOC */}
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">{t('afroloc_code') || 'Código AFROLOC'}</p>
            <p className="font-mono font-bold">{afrolocCode}</p>
            {propertyType && (
              <p className="text-xs text-muted-foreground mt-1">
                {t('property_type') || 'Tipo'}: {propertyType}
              </p>
            )}
          </div>

          {/* Número máximo de residentes */}
          <div className="space-y-2">
            <Label htmlFor="maxResidents" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('max_residents') || 'Número Máximo de Residentes'}
            </Label>
            <Input
              id="maxResidents"
              type="number"
              min={1}
              max={20}
              value={maxResidents}
              onChange={(e) => setMaxResidents(parseInt(e.target.value) || 1)}
            />
            <p className="text-xs text-muted-foreground">
              {t('max_residents_hint') || 'Defina quantas pessoas podem residir neste endereço (1-20)'}
            </p>
          </div>

          {/* Documentos obrigatórios por relação */}
          <div className="space-y-4">
            <Label>{t('required_documents_by_relationship') || 'Documentos Obrigatórios por Relação'}</Label>
            
            {relationships.map((rel) => (
              <Card key={rel.value}>
                <CardContent className="pt-4">
                  <p className="font-medium mb-3">{rel.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {documentTypes.map((doc) => (
                      <div key={doc.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${rel.value}-${doc.value}`}
                          checked={(requiredDocs[rel.value] || []).includes(doc.value)}
                          onCheckedChange={() => toggleDocument(rel.value, doc.value)}
                        />
                        <label
                          htmlFor={`${rel.value}-${doc.value}`}
                          className="text-sm cursor-pointer"
                        >
                          {doc.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('cancel') || 'Cancelar'}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('save_config') || 'Guardar Configuração'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
