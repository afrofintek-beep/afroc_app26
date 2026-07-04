import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, BookOpen, Loader2, Share2, FolderTree, Shield, Camera, Languages, FileCode } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";

interface DocumentInfo {
  id: string;
  titleKey: string;
  descriptionKey: string;
  filename: string;
  path: string;
  icon: React.ReactNode;
  sectionKeys: string[];
}

const documents: DocumentInfo[] = [
  {
    id: "manual",
    titleKey: "manualdl_doc_manual_title",
    descriptionKey: "manualdl_doc_manual_desc",
    filename: "MANUAL_DE_APOIO.md",
    path: "/MANUAL_DE_APOIO.md",
    icon: <BookOpen className="h-5 w-5" />,
    sectionKeys: [
      "manualdl_sec_estrutura_sistema",
      "manualdl_sec_gestao_utilizadores",
      "manualdl_sec_processo_registo",
      "manualdl_sec_ciclos_verificacao",
      "manualdl_sec_seguranca_rls",
      "manualdl_sec_troubleshooting"
    ]
  },
  {
    id: "hierarchical",
    titleKey: "manualdl_doc_hierarchical_title",
    descriptionKey: "manualdl_doc_hierarchical_desc",
    filename: "HIERARCHICAL_SYSTEM.md",
    path: "/HIERARCHICAL_SYSTEM.md",
    icon: <FolderTree className="h-5 w-5" />,
    sectionKeys: [
      "manualdl_sec_modelo_5_niveis",
      "manualdl_sec_responsabilidades_nivel",
      "manualdl_sec_estrutura_dados",
      "manualdl_sec_controle_acesso_rls",
      "manualdl_sec_interface_admin",
      "manualdl_sec_expansao_continental"
    ]
  },
  {
    id: "authorization",
    titleKey: "manualdl_doc_authorization_title",
    descriptionKey: "manualdl_doc_authorization_desc",
    filename: "AUTHORIZATION_SYSTEM.md",
    path: "/AUTHORIZATION_SYSTEM.md",
    icon: <Shield className="h-5 w-5" />,
    sectionKeys: [
      "manualdl_sec_authorization_levels",
      "manualdl_sec_criterios_progressao",
      "manualdl_sec_permissoes_nivel",
      "manualdl_sec_database_schema",
      "manualdl_sec_ui_components",
      "manualdl_sec_security_considerations"
    ]
  },
  {
    id: "camera",
    titleKey: "manualdl_doc_camera_title",
    descriptionKey: "manualdl_doc_camera_desc",
    filename: "CAMERA_PERMISSIONS.md",
    path: "/CAMERA_PERMISSIONS.md",
    icon: <Camera className="h-5 w-5" />,
    sectionKeys: [
      "manualdl_sec_ios_setup",
      "manualdl_sec_android_setup",
      "manualdl_sec_permission_flow",
      "manualdl_sec_troubleshooting",
      "manualdl_sec_photo_quality",
      "manualdl_sec_data_storage"
    ]
  },
  {
    id: "translation",
    titleKey: "manualdl_doc_translation_title",
    descriptionKey: "manualdl_doc_translation_desc",
    filename: "TRANSLATION_VALIDATION.md",
    path: "/TRANSLATION_VALIDATION.md",
    icon: <Languages className="h-5 w-5" />,
    sectionKeys: [
      "manualdl_sec_13_idiomas",
      "manualdl_sec_validation_report",
      "manualdl_sec_api_reference",
      "manualdl_sec_best_practices",
      "manualdl_sec_adding_languages",
      "manualdl_sec_console_logging"
    ]
  },
  {
    id: "complete",
    titleKey: "manualdl_doc_complete_title",
    descriptionKey: "manualdl_doc_complete_desc",
    filename: "AFROLOC_DOCUMENTACAO_COMPLETA.md",
    path: "/AFROLOC_DOCUMENTACAO_COMPLETA.md",
    icon: <FileCode className="h-5 w-5" />,
    sectionKeys: [
      "manualdl_sec_tipos_enderecos",
      "manualdl_sec_sistema_usuarios",
      "manualdl_sec_fluxo_registo",
      "manualdl_sec_score_ats",
      "manualdl_sec_edge_functions",
      "manualdl_sec_base_dados"
    ]
  }
];

const ManualDownload = () => {
  const { t } = useLanguage();
  const [generating, setGenerating] = useState<string | null>(null);

  const handleDownloadMarkdown = async (doc: DocumentInfo) => {
    try {
      const response = await fetch(doc.path);
      const content = await response.text();
      
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`${t('manualdl_toast_download_started')} ${t(doc.titleKey)}`);
    } catch (error) {
      console.error("Erro ao fazer download:", error);
      toast.error(t('manualdl_toast_download_error'));
    }
  };

  const handleGeneratePDF = async (doc: DocumentInfo) => {
    setGenerating(doc.id);
    try {
      const jsPDFModule = await import("jspdf");
      const jsPDF = jsPDFModule.default;
      
      const response = await fetch(doc.path);
      const content = await response.text();
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text(t(doc.titleKey), 20, 20);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(t(doc.descriptionKey), 20, 30);

      pdf.setFontSize(10);
      
      const lines = content.split('\n');
      let y = 45;
      const pageHeight = pdf.internal.pageSize.height;
      const lineHeight = 6;
      const margin = 20;
      const maxWidth = pdf.internal.pageSize.width - 2 * margin;

      for (const line of lines) {
        let cleanLine = line
          .replace(/^#{1,6}\s/, '')
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/`(.*?)`/g, '$1')
          .replace(/^[-*]\s/, '• ')
          .trim();

        if (!cleanLine) {
          y += lineHeight / 2;
          continue;
        }

        const wrappedLines = pdf.splitTextToSize(cleanLine, maxWidth);
        
        for (const wrappedLine of wrappedLines) {
          if (y > pageHeight - margin) {
            pdf.addPage();
            y = margin;
          }
          
          if (line.match(/^#{1,6}\s/) || cleanLine === cleanLine.toUpperCase()) {
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(12);
          } else {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
          }
          
          pdf.text(wrappedLine, margin, y);
          y += lineHeight;
        }
      }

      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text(
          `AFROLOC - ${t(doc.titleKey)} - ${t('manualdl_pdf_page')} ${i} ${t('manualdl_pdf_of')} ${totalPages}`,
          pdf.internal.pageSize.width / 2,
          pdf.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }

      pdf.save(doc.filename.replace('.md', '.pdf'));
      toast.success(t('manualdl_toast_pdf_success'));
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error(t('manualdl_toast_pdf_error'));
    } finally {
      setGenerating(null);
    }
  };

  const handleViewOnline = (doc: DocumentInfo) => {
    window.open(doc.path, '_blank');
  };

  const handleDownloadAll = async () => {
    for (const doc of documents) {
      await handleDownloadMarkdown(doc);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    toast.success(t('manualdl_toast_all_downloaded'));
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6 pb-20 md:pb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{t('manualdl_page_title')}</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                {t('manualdl_page_subtitle')}
              </p>
            </div>
          </div>
          <Button onClick={handleDownloadAll} variant="default" size="sm">
            <Download className="mr-2 h-4 w-4" />
            {t('manualdl_btn_all')}
          </Button>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="all">{t('manualdl_tab_all')}</TabsTrigger>
            <TabsTrigger value="manual">{t('manualdl_tab_manual')}</TabsTrigger>
            <TabsTrigger value="technical">{t('manualdl_tab_technical')}</TabsTrigger>
            <TabsTrigger value="config">{t('manualdl_tab_config')}</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  generating={generating}
                  onDownload={handleDownloadMarkdown}
                  onGeneratePDF={handleGeneratePDF}
                  onView={handleViewOnline}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {documents.filter(d => d.id === "manual").map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  generating={generating}
                  onDownload={handleDownloadMarkdown}
                  onGeneratePDF={handleGeneratePDF}
                  onView={handleViewOnline}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="technical" className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {documents.filter(d => ["hierarchical", "authorization", "complete"].includes(d.id)).map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  generating={generating}
                  onDownload={handleDownloadMarkdown}
                  onGeneratePDF={handleGeneratePDF}
                  onView={handleViewOnline}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="config" className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {documents.filter(d => ["camera", "translation"].includes(d.id)).map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  generating={generating}
                  onDownload={handleDownloadMarkdown}
                  onGeneratePDF={handleGeneratePDF}
                  onView={handleViewOnline}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">{t('manualdl_info_title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs md:text-sm">
            <p>✅ {t('manualdl_info_line1')}</p>
            <p>✅ {t('manualdl_info_line2')}</p>
            <p>✅ {t('manualdl_info_line3')}</p>
            <p>✅ {t('manualdl_info_line4')}</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

interface DocumentCardProps {
  doc: DocumentInfo;
  generating: string | null;
  onDownload: (doc: DocumentInfo) => void;
  onGeneratePDF: (doc: DocumentInfo) => void;
  onView: (doc: DocumentInfo) => void;
}

const DocumentCard = ({ doc, generating, onDownload, onGeneratePDF, onView }: DocumentCardProps) => {
  const { t } = useLanguage();
  return (
  <Card className="flex flex-col">
    <CardHeader className="pb-3">
      <div className="flex items-center gap-2">
        <div className="text-primary">{doc.icon}</div>
        <CardTitle className="text-base md:text-lg">{t(doc.titleKey)}</CardTitle>
      </div>
      <CardDescription className="text-xs md:text-sm">
        {t(doc.descriptionKey)}
      </CardDescription>
    </CardHeader>
    <CardContent className="flex-1 space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{t('manualdl_content_label')}</p>
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {doc.sectionKeys.slice(0, 4).map((sectionKey, i) => (
            <li key={i}>• {t(sectionKey)}</li>
          ))}
          {doc.sectionKeys.length > 4 && (
            <li className="text-primary">+ {doc.sectionKeys.length - 4} {t('manualdl_more_suffix')}</li>
          )}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button 
          onClick={() => onDownload(doc)} 
          variant="outline"
          size="sm"
          className="flex-1"
        >
          <Download className="mr-1 h-3 w-3" />
          MD
        </Button>
        <Button 
          onClick={() => onGeneratePDF(doc)} 
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={generating === doc.id}
        >
          {generating === doc.id ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <FileText className="mr-1 h-3 w-3" />
          )}
          PDF
        </Button>
        <Button 
          onClick={() => onView(doc)} 
          variant="secondary"
          size="sm"
          className="flex-1"
        >
          <BookOpen className="mr-1 h-3 w-3" />
          {t('manualdl_btn_view')}
        </Button>
      </div>
    </CardContent>
  </Card>
  );
};

export default ManualDownload;