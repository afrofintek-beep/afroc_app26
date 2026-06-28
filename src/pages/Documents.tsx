import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { documentsApi, Document, DocumentVerification } from "@/hooks/useDocumentsApi";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Loader2, ShieldCheck, ShieldX, ShieldQuestion, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const CATEGORIES = [
  { value: "all", label: "all_categories", displayLabel: "Todas categorias" },
  { value: "juridico", label: "legal_documents", displayLabel: "Jurídico" },
  { value: "governo", label: "government", displayLabel: "Governo" },
  { value: "dfis", label: "dfis", displayLabel: "DFIs" },
  { value: "tecnico", label: "technical_docs", displayLabel: "Técnico" },
];

const LANGUAGES = [
  { value: "all", label: "all_languages", displayLabel: "Todos idiomas" },
  { value: "pt", label: "portuguese", displayLabel: "Português" },
  { value: "en", label: "english", displayLabel: "English" },
  { value: "fr", label: "french", displayLabel: "Français" },
];

type VerificationState = {
  loading: boolean;
  result?: DocumentVerification;
  error?: string;
};

export default function Documents() {
  const { t } = useLanguage();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [language, setLanguage] = useState("all");
  const [verifications, setVerifications] = useState<Record<string, VerificationState>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

  useEffect(() => {
    fetchDocuments();
    setCurrentPage(1);
  }, [category, language]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await documentsApi.listDocs({
        category: category === "all" ? null : category,
        language: language === "all" ? null : language,
        visibility: "public",
      });

      if (response.success && response.data) {
        setDocuments(response.data);
      } else {
        toast({
          title: t("error"),
          description: response.error || t("failed_to_load_documents"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast({
        title: t("error"),
        description: t("failed_to_load_documents"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    setDownloadingId(doc.id);
    try {
      const blob = await documentsApi.downloadDoc(doc.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${doc.title}_v${doc.version}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: t("download_complete"),
          description: doc.title,
        });
      } else {
        throw new Error("Download failed");
      }
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: t("error"),
        description: t("download_failed"),
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleVerify = async (doc: Document) => {
    setVerifications((prev) => ({
      ...prev,
      [doc.id]: { loading: true },
    }));

    try {
      const response = await documentsApi.verifyDoc(doc.id);
      if (response.success && response.data) {
        setVerifications((prev) => ({
          ...prev,
          [doc.id]: { loading: false, result: response.data },
        }));
        
        if (response.data.integrity_valid) {
          toast({
            title: "Integridade Verificada",
            description: "O documento não foi alterado.",
          });
        } else {
          toast({
            title: "Integridade Comprometida",
            description: "O hash SHA-256 não corresponde.",
            variant: "destructive",
          });
        }
      } else {
        throw new Error(response.error || "Verification failed");
      }
    } catch (error) {
      console.error("Verification error:", error);
      setVerifications((prev) => ({
        ...prev,
        [doc.id]: { loading: false, error: "Falha na verificação" },
      }));
      toast({
        title: t("error"),
        description: "Falha na verificação de integridade",
        variant: "destructive",
      });
    }
  };

  const renderVerificationStatus = (doc: Document) => {
    const state = verifications[doc.id];

    if (!state) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleVerify(doc)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ShieldQuestion className="h-4 w-4 mr-1" />
          Verificar
        </Button>
      );
    }

    if (state.loading) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Verificando...
        </Badge>
      );
    }

    if (state.error) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="gap-1 cursor-help">
              <ShieldX className="h-3 w-3" />
              Erro
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{state.error}</TooltipContent>
        </Tooltip>
      );
    }

    if (state.result) {
      const isValid = state.result.integrity_valid;
      const shortHash = state.result.stored_sha256?.slice(0, 12) + "...";

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={isValid ? "default" : "destructive"}
              className="gap-1 cursor-help font-mono text-xs"
            >
              {isValid ? (
                <ShieldCheck className="h-3 w-3" />
              ) : (
                <ShieldX className="h-3 w-3" />
              )}
              {shortHash}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1 text-xs">
              <p><strong>SHA-256:</strong></p>
              <p className="font-mono break-all">{state.result.stored_sha256}</p>
              <p className="mt-2">
                <strong>Status:</strong>{" "}
                {isValid ? "✓ Íntegro" : "✗ Hash não corresponde"}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }

    return null;
  };

  return (
    <DashboardLayout>
      <Card>
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold">{t("official_documents")}</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Versões oficiais, auditáveis e sem dados pessoais
          </p>

          <div className="flex gap-3 mt-4">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.displayLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.displayLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="mt-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 mt-6">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t("no_documents_found")}</p>
            </div>
          ) : (
            <>
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Título</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Idioma</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Integridade</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.title}</TableCell>
                        <TableCell>{doc.category}</TableCell>
                        <TableCell>{doc.language.toUpperCase()}</TableCell>
                        <TableCell className="font-mono text-sm">{doc.version}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {new Date(doc.published_at).toISOString().slice(0, 10)}
                        </TableCell>
                        <TableCell>{renderVerificationStatus(doc)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            disabled={downloadingId === doc.id}
                            className="font-mono"
                          >
                            {downloadingId === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Mostrar</span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(val) => {
                      setPageSize(Number(val));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[70px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={size.toString()}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>por página</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {Math.min((currentPage - 1) * pageSize + 1, documents.length)}–
                    {Math.min(currentPage * pageSize, documents.length)} de {documents.length}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        setCurrentPage((p) =>
                          Math.min(Math.ceil(documents.length / pageSize), p + 1)
                        )
                      }
                      disabled={currentPage >= Math.ceil(documents.length / pageSize)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}