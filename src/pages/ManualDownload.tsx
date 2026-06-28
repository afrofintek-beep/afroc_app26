import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, BookOpen, Loader2, Share2, FolderTree, Shield, Camera, Languages, FileCode } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DocumentInfo {
  id: string;
  title: string;
  description: string;
  filename: string;
  path: string;
  icon: React.ReactNode;
  sections: string[];
}

const documents: DocumentInfo[] = [
  {
    id: "manual",
    title: "Manual de Apoio",
    description: "Documentação operacional completa do sistema",
    filename: "MANUAL_DE_APOIO.md",
    path: "/MANUAL_DE_APOIO.md",
    icon: <BookOpen className="h-5 w-5" />,
    sections: [
      "Estrutura do Sistema",
      "Gestão de Utilizadores",
      "Processo de Registo",
      "Ciclos de Verificação",
      "Segurança e RLS",
      "Troubleshooting"
    ]
  },
  {
    id: "hierarchical",
    title: "Arquitectura do Sistema",
    description: "Sistema hierárquico de 5 níveis para gestão",
    filename: "HIERARCHICAL_SYSTEM.md",
    path: "/HIERARCHICAL_SYSTEM.md",
    icon: <FolderTree className="h-5 w-5" />,
    sections: [
      "Modelo de 5 Níveis",
      "Responsabilidades por Nível",
      "Estrutura de Dados",
      "Controle de Acesso (RLS)",
      "Interface Administrativa",
      "Expansão Continental"
    ]
  },
  {
    id: "authorization",
    title: "Sistema de Autorização",
    description: "5 níveis de autorização baseados em confiança",
    filename: "AUTHORIZATION_SYSTEM.md",
    path: "/AUTHORIZATION_SYSTEM.md",
    icon: <Shield className="h-5 w-5" />,
    sections: [
      "Authorization Levels (1-5)",
      "Critérios de Progressão",
      "Permissões por Nível",
      "Database Schema",
      "UI Components",
      "Security Considerations"
    ]
  },
  {
    id: "camera",
    title: "Permissões de Câmera",
    description: "Configuração para iOS e Android",
    filename: "CAMERA_PERMISSIONS.md",
    path: "/CAMERA_PERMISSIONS.md",
    icon: <Camera className="h-5 w-5" />,
    sections: [
      "iOS Setup (Info.plist)",
      "Android Setup (Manifest)",
      "Permission Flow",
      "Troubleshooting",
      "Photo Quality Settings",
      "Data Storage"
    ]
  },
  {
    id: "translation",
    title: "Validação de Traduções",
    description: "Ferramenta de validação para 13 idiomas",
    filename: "TRANSLATION_VALIDATION.md",
    path: "/TRANSLATION_VALIDATION.md",
    icon: <Languages className="h-5 w-5" />,
    sections: [
      "13 Idiomas Suportados",
      "Validation Report",
      "API Reference",
      "Best Practices",
      "Adding New Languages",
      "Console Logging"
    ]
  },
  {
    id: "complete",
    title: "Documentação Completa",
    description: "Documentação técnica A-Z do sistema AFROLOC",
    filename: "AFROLOC_DOCUMENTACAO_COMPLETA.md",
    path: "/AFROLOC_DOCUMENTACAO_COMPLETA.md",
    icon: <FileCode className="h-5 w-5" />,
    sections: [
      "Tipos de Endereços",
      "Sistema de Usuários",
      "Fluxo de Registo",
      "Score ATS",
      "Edge Functions",
      "Base de Dados"
    ]
  }
];

const ManualDownload = () => {
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
      
      toast.success(`Download de ${doc.title} iniciado`);
    } catch (error) {
      console.error("Erro ao fazer download:", error);
      toast.error("Erro ao fazer download do documento");
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
      pdf.text(doc.title, 20, 20);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(doc.description, 20, 30);

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
          `AFROLOC - ${doc.title} - Página ${i} de ${totalPages}`,
          pdf.internal.pageSize.width / 2,
          pdf.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }

      pdf.save(doc.filename.replace('.md', '.pdf'));
      toast.success("PDF gerado com sucesso");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
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
    toast.success("Todos os documentos foram descarregados");
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6 pb-20 md:pb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Documentação</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Documentação completa do sistema AFROLOC
              </p>
            </div>
          </div>
          <Button onClick={handleDownloadAll} variant="default" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Todos
          </Button>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="technical">Técnicos</TabsTrigger>
            <TabsTrigger value="config">Configuração</TabsTrigger>
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
            <CardTitle className="text-lg md:text-xl">Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs md:text-sm">
            <p>✅ Todos os documentos estão atualizados com as últimas funcionalidades</p>
            <p>✅ Inclui documentação para Angola como país validador ativo</p>
            <p>✅ Contém comandos SQL, exemplos práticos e diagramas</p>
            <p>✅ Disponível em Markdown (editável) e PDF (impressão)</p>
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

const DocumentCard = ({ doc, generating, onDownload, onGeneratePDF, onView }: DocumentCardProps) => (
  <Card className="flex flex-col">
    <CardHeader className="pb-3">
      <div className="flex items-center gap-2">
        <div className="text-primary">{doc.icon}</div>
        <CardTitle className="text-base md:text-lg">{doc.title}</CardTitle>
      </div>
      <CardDescription className="text-xs md:text-sm">
        {doc.description}
      </CardDescription>
    </CardHeader>
    <CardContent className="flex-1 space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Conteúdo:</p>
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {doc.sections.slice(0, 4).map((section, i) => (
            <li key={i}>• {section}</li>
          ))}
          {doc.sections.length > 4 && (
            <li className="text-primary">+ {doc.sections.length - 4} mais...</li>
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
          Ver
        </Button>
      </div>
    </CardContent>
  </Card>
);

export default ManualDownload;