import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { documentsApi, Document } from "@/hooks/useDocumentsApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileText, Download, Search, Calendar, ArrowLeft, Globe, Scale, Building2, Cpu, FileCheck } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/afroloc-symbol.png";

const CATEGORIES = [
  { value: "all", label: "Todos", icon: FileText },
  { value: "juridico", label: "Jurídico", icon: Scale },
  { value: "governo", label: "Governo", icon: Building2 },
  { value: "dfis", label: "DFIS", icon: FileCheck },
  { value: "tecnico", label: "Técnico", icon: Cpu },
];

const LANGUAGE_LABELS: Record<string, string> = {
  pt: "Português",
  en: "English",
  fr: "Français",
};

const PublicDocuments = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const response = await documentsApi.listDocs({ visibility: "public" });
      
      if (response.success && response.data) {
        setDocuments(response.data);
      } else {
        console.error("Error loading documents:", response.error);
        toast({
          title: "Erro",
          description: response.error || "Erro ao carregar documentos",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error loading documents:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar documentos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    setDownloading(doc.id);
    try {
      const blob = await documentsApi.downloadDoc(doc.id);
      
      if (blob) {
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${doc.title}_${doc.version}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Download iniciado",
          description: `${doc.title} está a ser descarregado`,
        });
      } else {
        throw new Error("Download failed");
      }
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Erro no download",
        description: "Não foi possível descarregar o documento",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "all" || doc.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const getDocumentsByCategory = (category: string) => {
    return filteredDocuments.filter(doc => doc.category === category);
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat?.icon || FileText;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      juridico: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
      governo: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
      dfis: "from-green-500/20 to-green-600/10 border-green-500/30",
      tecnico: "from-orange-500/20 to-orange-600/10 border-orange-500/30",
    };
    return colors[category] || "from-primary/20 to-primary/10 border-primary/30";
  };

  const getCategoryIconColor = (category: string) => {
    const colors: Record<string, string> = {
      juridico: "text-blue-400",
      governo: "text-purple-400",
      dfis: "text-green-400",
      tecnico: "text-orange-400",
    };
    return colors[category] || "text-primary";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link to="/landing" className="flex items-center gap-3">
              <img src={logo} alt="AFROLOC" className="h-8 w-8 object-cover rounded-lg" />
              <span className="text-lg font-bold text-primary">AFROLOC</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link to="/landing">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="sm">
                  Entrar
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Globe className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary font-medium">Documentos Públicos</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Biblioteca de Documentos
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              Aceda a documentos jurídicos, governamentais, técnicos e DFIS do sistema AFROLOC
            </p>
            
            {/* Search */}
            <div className="max-w-md mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Pesquisar documentos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 text-lg bg-card/50 border-border/50"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Category Tabs */}
      <section className="py-8 border-b border-border bg-card/30">
        <div className="container mx-auto px-4">
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
            <TabsList className="w-full max-w-2xl mx-auto grid grid-cols-5 h-auto p-1">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const count = cat.value === "all" 
                  ? documents.filter(d => d.title.toLowerCase().includes(searchQuery.toLowerCase())).length
                  : getDocumentsByCategory(cat.value).length;
                return (
                  <TabsTrigger 
                    key={cat.value} 
                    value={cat.value}
                    className="flex flex-col gap-1 py-3 data-[state=active]:bg-primary/20"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{cat.label}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {count}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </section>

      {/* Documents Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-pulse text-muted-foreground">Carregando documentos...</div>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-20">
              <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Nenhum documento encontrado
              </h3>
              <p className="text-muted-foreground">
                {searchQuery 
                  ? "Tente ajustar os termos de pesquisa" 
                  : "Ainda não existem documentos públicos nesta categoria"}
              </p>
            </div>
          ) : activeCategory === "all" ? (
            // Show documents grouped by category
            <div className="space-y-12">
              {CATEGORIES.filter(c => c.value !== "all").map(cat => {
                const categoryDocs = getDocumentsByCategory(cat.value);
                if (categoryDocs.length === 0) return null;
                
                const Icon = cat.icon;
                return (
                  <div key={cat.value}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${getCategoryColor(cat.value)}`}>
                        <Icon className={`h-5 w-5 ${getCategoryIconColor(cat.value)}`} />
                      </div>
                      <h2 className="text-xl font-semibold text-foreground">{cat.label}</h2>
                      <Badge variant="outline">{categoryDocs.length}</Badge>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categoryDocs.map(doc => (
                        <DocumentCard 
                          key={doc.id} 
                          doc={doc} 
                          onDownload={handleDownload}
                          downloading={downloading === doc.id}
                          getCategoryColor={getCategoryColor}
                          getCategoryIconColor={getCategoryIconColor}
                          getCategoryIcon={getCategoryIcon}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Show filtered documents
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map(doc => (
                <DocumentCard 
                  key={doc.id} 
                  doc={doc} 
                  onDownload={handleDownload}
                  downloading={downloading === doc.id}
                  getCategoryColor={getCategoryColor}
                  getCategoryIconColor={getCategoryIconColor}
                  getCategoryIcon={getCategoryIcon}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border bg-card/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} AFROLOC. Todos os direitos reservados.
          </p>
          <div className="flex justify-center gap-4 mt-4">
            <Link to="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Sobre
            </Link>
            <Link to="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Contacto
            </Link>
            <Link to="/faq" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              FAQ
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Document Card Component
interface DocumentCardProps {
  doc: Document;
  onDownload: (doc: Document) => void;
  downloading: boolean;
  getCategoryColor: (category: string) => string;
  getCategoryIconColor: (category: string) => string;
  getCategoryIcon: (category: string) => React.ComponentType<any>;
}

const DocumentCard = ({ doc, onDownload, downloading, getCategoryColor, getCategoryIconColor, getCategoryIcon }: DocumentCardProps) => {
  const Icon = getCategoryIcon(doc.category);
  
  return (
    <Card className={`group hover:shadow-lg transition-all duration-300 bg-gradient-to-br ${getCategoryColor(doc.category)} border overflow-hidden`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl bg-background/50 group-hover:bg-background/80 transition-colors`}>
            <Icon className={`h-6 w-6 ${getCategoryIconColor(doc.category)}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground mb-1 line-clamp-2 group-hover:text-primary transition-colors">
              {doc.title}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
              <Badge variant="outline" className="text-[10px]">
                {LANGUAGE_LABELS[doc.language] || doc.language}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {doc.version}
              </Badge>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(doc.published_at), "dd/MM/yyyy")}
              </span>
            </div>
            <Button 
              size="sm" 
              variant="secondary"
              onClick={() => onDownload(doc)}
              disabled={downloading}
              className="w-full gap-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
            >
              <Download className={`h-4 w-4 ${downloading ? 'animate-bounce' : ''}`} />
              {downloading ? "A descarregar..." : "Descarregar"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PublicDocuments;
