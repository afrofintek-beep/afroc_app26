import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  Upload, 
  Loader2, 
  FileText, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Calendar,
  AlertTriangle
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type ResidentDocumentType = Database["public"]["Enums"]["resident_document_type"];

interface ResidentDocumentUploadProps {
  residentId: string;
  requiredDocuments: ResidentDocumentType[];
  existingDocuments: Array<{
    id: string;
    document_type: ResidentDocumentType;
    status: string;
    file_name: string;
    expiry_date?: string | null;
  }>;
  onDocumentUploaded: () => void;
}

export function ResidentDocumentUpload({
  residentId,
  requiredDocuments,
  existingDocuments,
  onDocumentUploaded,
}: ResidentDocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<ResidentDocumentType | "">("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  const documentTypeLabels: Record<ResidentDocumentType, string> = {
    identity_card: t('doc_identity_card') || 'Bilhete de Identidade',
    passport: t('doc_passport') || 'Passaporte',
    birth_certificate: t('doc_birth_certificate') || 'Certidão de Nascimento',
    marriage_certificate: t('doc_marriage_certificate') || 'Certidão de Casamento',
    rental_contract: t('doc_rental_contract') || 'Contrato de Arrendamento',
    property_deed: t('doc_property_deed') || 'Escritura de Propriedade',
    residence_declaration: t('doc_residence_declaration') || 'Declaração de Residência',
  };

  const documentStatusInfo = (status: string) => {
    switch (status) {
      case 'verified':
        return { icon: <CheckCircle2 className="h-4 w-4" />, variant: 'default' as const, label: t('verified') || 'Verificado' };
      case 'pending':
        return { icon: <Clock className="h-4 w-4" />, variant: 'secondary' as const, label: t('pending') || 'Pendente' };
      case 'rejected':
        return { icon: <XCircle className="h-4 w-4" />, variant: 'destructive' as const, label: t('rejected') || 'Rejeitado' };
      default:
        return { icon: <Clock className="h-4 w-4" />, variant: 'outline' as const, label: status };
    }
  };

  const missingDocuments = requiredDocuments.filter(
    docType => !existingDocuments.some(d => d.document_type === docType && d.status !== 'rejected')
  );

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedType) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t('file_too_large') || 'Ficheiro muito grande',
        description: t('max_file_size') || 'O ficheiro não pode exceder 10MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Upload do ficheiro
      const fileExt = file.name.split('.').pop();
      const fileName = `${residentId}/${selectedType}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('resident-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Criar registo do documento
      const { error: insertError } = await supabase
        .from('afroloc_resident_documents')
        .insert({
          resident_id: residentId,
          user_id: session.user.id,
          document_type: selectedType,
          file_path: fileName,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          document_number: documentNumber || null,
          expiry_date: expiryDate || null,
          status: 'pending',
        });

      if (insertError) throw insertError;

      toast({
        title: t('document_uploaded') || 'Documento Carregado',
        description: t('document_pending_review') || 'O documento está a aguardar verificação',
      });

      // Reset form
      setSelectedType("");
      setDocumentNumber("");
      setExpiryDate("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      onDocumentUploaded();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast({
        title: t('upload_error') || 'Erro no Upload',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const isExpiringSoon = (expiryDate?: string | null) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate?: string | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t('required_documents') || 'Documentos Obrigatórios'}
        </CardTitle>
        <CardDescription>
          {t('upload_required_docs') || 'Carregue os documentos necessários para validar a sua residência'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Lista de documentos existentes */}
        {existingDocuments.length > 0 && (
          <div className="space-y-3">
            <Label>{t('submitted_documents') || 'Documentos Submetidos'}</Label>
            {existingDocuments.map((doc) => {
              const statusInfo = documentStatusInfo(doc.status);
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">
                        {documentTypeLabels[doc.document_type]}
                      </p>
                      <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                      {doc.expiry_date && (
                        <div className="flex items-center gap-1 text-xs mt-1">
                          <Calendar className="h-3 w-3" />
                          <span className={
                            isExpired(doc.expiry_date) 
                              ? "text-destructive" 
                              : isExpiringSoon(doc.expiry_date) 
                                ? "text-accent-foreground" 
                                : "text-muted-foreground"
                          }>
                            {t('expires') || 'Expira'}: {new Date(doc.expiry_date).toLocaleDateString()}
                          </span>
                          {isExpired(doc.expiry_date) && (
                            <Badge variant="destructive" className="text-xs ml-2">
                              {t('expired') || 'Expirado'}
                            </Badge>
                          )}
                          {isExpiringSoon(doc.expiry_date) && !isExpired(doc.expiry_date) && (
                            <Badge variant="outline" className="text-xs ml-2 text-accent-foreground border-accent">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {t('expiring_soon') || 'A expirar'}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant={statusInfo.variant} className="flex items-center gap-1">
                    {statusInfo.icon}
                    {statusInfo.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}

        {/* Documentos em falta */}
        {missingDocuments.length > 0 && (
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {t('missing_documents') || 'Documentos em Falta'}
            </Label>
            <div className="flex flex-wrap gap-2">
              {missingDocuments.map((docType) => (
                <Badge key={docType} variant="outline" className="text-destructive border-destructive">
                  {documentTypeLabels[docType]}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Formulário de upload */}
        <div className="space-y-4 pt-4 border-t">
          <Label>{t('upload_new_document') || 'Carregar Novo Documento'}</Label>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('document_type') || 'Tipo de Documento'}</Label>
              <Select value={selectedType} onValueChange={(val) => setSelectedType(val as ResidentDocumentType)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('select_document_type') || 'Selecionar tipo'} />
                </SelectTrigger>
                <SelectContent>
                  {requiredDocuments.map((docType) => (
                    <SelectItem key={docType} value={docType}>
                      {documentTypeLabels[docType]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('document_number') || 'Número do Documento'}</Label>
              <Input
                placeholder="Ex: 000123456LA789"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('expiry_date') || 'Data de Validade'}</Label>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t('expiry_date_hint') || 'Obrigatório para BI/Passaporte e Contrato de Arrendamento'}
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileSelect}
              disabled={!selectedType || uploading}
              className="flex-1"
            />
            <Button disabled={!selectedType || uploading}>
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('accepted_formats') || 'Formatos aceites: PDF, JPG, PNG (máx. 10MB)'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
