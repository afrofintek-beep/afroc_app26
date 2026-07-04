import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { documentsApi, Document } from "@/hooks/useDocumentsApi";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileText, Upload, Pencil, Trash2, Download, Search, Filter, Eye, Plus, Calendar, Lock, Globe, FileCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";

const CATEGORIES = [
  { value: "juridico", label: "Jurídico" },
  { value: "governo", label: "Governo" },
  { value: "dfis", label: "DFIS" },
  { value: "tecnico", label: "Técnico" },
];

const LANGUAGES = [
  { value: "pt", label: "Português" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
];

const VISIBILITIES = [
  { value: "public", label: "Público", icon: Globe },
  { value: "restricted", label: "Restrito", icon: Lock },
];

const AdminDocumentLibrary = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const CATEGORY_LABELS: Record<string, string> = {
    juridico: t('docslib_cat_juridico'),
    governo: t('docslib_cat_governo'),
    dfis: t('docslib_cat_dfis'),
    tecnico: t('docslib_cat_tecnico'),
  };

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all");

  // Dialog states
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  // Form states
  const [formData, setFormData] = useState({
    title: "",
    category: "juridico",
    language: "pt",
    version: "v1.0",
    visibility: "public",
    published_at: new Date().toISOString().split("T")[0],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }
    loadDocuments();
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const response = await documentsApi.listDocs({});
      if (response.success && response.data) {
        setDocuments(response.data);
      } else {
        toast.error(t('docslib_toast_load_error') + ": " + (response.error || t('docslib_unknown_error')));
      }
    } catch (error: any) {
      toast.error(t('docslib_toast_load_error') + ": " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateSHA256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error(t('docslib_toast_select_file'));
      return;
    }

    if (!formData.title.trim()) {
      toast.error(t('docslib_toast_title_required'));
      return;
    }

    setUploading(true);
    try {
      const response = await documentsApi.uploadDoc(selectedFile, {
        title: formData.title.trim(),
        category: formData.category,
        language: formData.language,
        version: formData.version,
        visibility: formData.visibility,
      });

      if (response.success) {
        toast.success(t('docslib_toast_upload_success'));
        setIsUploadDialogOpen(false);
        resetForm();
        loadDocuments();
      } else {
        throw new Error(response.error || "Upload failed");
      }
    } catch (error: any) {
      toast.error(t('docslib_toast_upload_error') + ": " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedDocument) return;

    try {
      const { error } = await supabase
        .from("documents")
        .update({
          title: formData.title.trim(),
          category: formData.category,
          language: formData.language,
          version: formData.version,
          visibility: formData.visibility,
          published_at: new Date(formData.published_at).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedDocument.id);

      if (error) throw error;

      toast.success(t('docslib_toast_update_success'));
      setIsEditDialogOpen(false);
      resetForm();
      loadDocuments();
    } catch (error: any) {
      toast.error(t('docslib_toast_update_error') + ": " + error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedDocument) return;

    try {
      const response = await documentsApi.deleteDoc(selectedDocument.id);
      
      if (response.success) {
        toast.success(t('docslib_toast_delete_success'));
        setIsDeleteDialogOpen(false);
        setSelectedDocument(null);
        loadDocuments();
      } else {
        throw new Error(response.error || "Delete failed");
      }
    } catch (error: any) {
      toast.error(t('docslib_toast_delete_error') + ": " + error.message);
    }
  };

  const handlePreview = async (doc: Document) => {
    try {
      const { data } = supabase.storage
        .from("document-library")
        .getPublicUrl(doc.file_path);

      setPreviewUrl(data.publicUrl);
      setSelectedDocument(doc);
      setIsPreviewDialogOpen(true);
    } catch (error: any) {
      toast.error(t('docslib_toast_preview_error'));
    }
  };

  const handleDownload = async (doc: Document) => {
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
        toast.success(t('docslib_toast_download_success'));
      } else {
        throw new Error("Download failed");
      }
    } catch (error: any) {
      toast.error(t('docslib_toast_download_error'));
    }
  };

  const openEditDialog = (doc: Document) => {
    setSelectedDocument(doc);
    setFormData({
      title: doc.title,
      category: doc.category,
      language: doc.language,
      version: doc.version,
      visibility: doc.visibility,
      published_at: doc.published_at.split("T")[0],
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (doc: Document) => {
    setSelectedDocument(doc);
    setIsDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      category: "juridico",
      language: "pt",
      version: "v1.0",
      visibility: "public",
      published_at: new Date().toISOString().split("T")[0],
    });
    setSelectedFile(null);
    setSelectedDocument(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
    const matchesLanguage = languageFilter === "all" || doc.language === languageFilter;
    const matchesVisibility = visibilityFilter === "all" || doc.visibility === visibilityFilter;
    return matchesSearch && matchesCategory && matchesLanguage && matchesVisibility;
  });

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      juridico: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      governo: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      dfis: "bg-green-500/20 text-green-400 border-green-500/30",
      tecnico: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    };
    return (
      <Badge className={`${colors[category]} border`}>
        {CATEGORY_LABELS[category] || category}
      </Badge>
    );
  };

  const getLanguageBadge = (language: string) => {
    const labels: Record<string, string> = {
      pt: "PT",
      en: "EN",
      fr: "FR",
    };
    return (
      <Badge variant="outline" className="text-xs">
        {labels[language] || language}
      </Badge>
    );
  };

  const getVisibilityBadge = (visibility: string) => {
    if (visibility === "public") {
      return (
        <Badge className="bg-green-500/20 text-green-400 border border-green-500/30">
          <Globe className="h-3 w-3 mr-1" />
          {t('docslib_visibility_public')}
        </Badge>
      );
    }
    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
        <Lock className="h-3 w-3 mr-1" />
        {t('docslib_visibility_restricted')}
      </Badge>
    );
  };

  const getStats = () => {
    return {
      total: documents.length,
      public: documents.filter(d => d.visibility === "public").length,
      restricted: documents.filter(d => d.visibility === "restricted").length,
      byCategory: CATEGORIES.map(cat => ({
        ...cat,
        count: documents.filter(d => d.category === cat.value).length,
      })),
    };
  };

  const stats = getStats();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              {t('docslib_page_title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('docslib_page_subtitle')}
            </p>
          </div>
          <Button onClick={() => setIsUploadDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('docslib_new_document')}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">{t('docslib_stat_total')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Globe className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.public}</p>
                  <p className="text-xs text-muted-foreground">{t('docslib_stat_public')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Lock className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.restricted}</p>
                  <p className="text-xs text-muted-foreground">{t('docslib_stat_restricted')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-1">
                {stats.byCategory.map(cat => (
                  <Badge key={cat.value} variant="outline" className="text-xs">
                    {CATEGORY_LABELS[cat.value] || cat.label}: {cat.count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('docslib_search_placeholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder={t('docslib_filter_category')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('docslib_filter_all_f')}</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{CATEGORY_LABELS[cat.value] || cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger className="w-full md:w-32">
                  <SelectValue placeholder={t('docslib_filter_language')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('docslib_filter_all_m')}</SelectItem>
                  {LANGUAGES.map(lang => (
                    <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                <SelectTrigger className="w-full md:w-36">
                  <SelectValue placeholder={t('docslib_filter_visibility')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('docslib_filter_all_f')}</SelectItem>
                  {VISIBILITIES.map(vis => (
                    <SelectItem key={vis.value} value={vis.value}>{vis.value === "public" ? t('docslib_visibility_public') : t('docslib_visibility_restricted')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Documents Table */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('docslib_th_title')}</TableHead>
                  <TableHead>{t('docslib_th_category')}</TableHead>
                  <TableHead>{t('docslib_th_language')}</TableHead>
                  <TableHead>{t('docslib_th_version')}</TableHead>
                  <TableHead>{t('docslib_th_visibility')}</TableHead>
                  <TableHead>{t('docslib_th_published')}</TableHead>
                  <TableHead className="text-right">{t('docslib_th_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="animate-pulse text-muted-foreground">{t('docslib_loading')}</div>
                    </TableCell>
                  </TableRow>
                ) : filteredDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t('docslib_empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocuments.map(doc => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.title}</TableCell>
                      <TableCell>{getCategoryBadge(doc.category)}</TableCell>
                      <TableCell>{getLanguageBadge(doc.language)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{doc.version}</Badge>
                      </TableCell>
                      <TableCell>{getVisibilityBadge(doc.visibility)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(doc.published_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePreview(doc)}
                            title={t('docslib_action_preview')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(doc)}
                            title={t('docslib_action_download')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(doc)}
                            title={t('docslib_action_edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(doc)}
                            className="text-destructive hover:text-destructive"
                            title={t('docslib_action_delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={(open) => { setIsUploadDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              {t('docslib_upload_title')}
            </DialogTitle>
            <DialogDescription>
              {t('docslib_upload_description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('docslib_label_title')}</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t('docslib_placeholder_title')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('docslib_label_category')}</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{CATEGORY_LABELS[cat.value] || cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('docslib_label_language')}</Label>
                <Select value={formData.language} onValueChange={(v) => setFormData({ ...formData, language: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('docslib_label_version')}</Label>
                <Input
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="v1.0"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('docslib_label_visibility')}</Label>
                <Select value={formData.visibility} onValueChange={(v) => setFormData({ ...formData, visibility: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIBILITIES.map(vis => (
                      <SelectItem key={vis.value} value={vis.value}>{vis.value === "public" ? t('docslib_visibility_public') : t('docslib_visibility_restricted')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('docslib_label_published_at')}</Label>
              <Input
                type="date"
                value={formData.published_at}
                onChange={(e) => setFormData({ ...formData, published_at: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('docslib_label_file')}</Label>
              <Input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground">
                  {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              {t('docslib_btn_cancel')}
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? t('docslib_btn_uploading') : t('docslib_btn_upload')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              {t('docslib_edit_title')}
            </DialogTitle>
            <DialogDescription>
              {t('docslib_edit_description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('docslib_label_title')}</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t('docslib_placeholder_title')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('docslib_label_category')}</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{CATEGORY_LABELS[cat.value] || cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('docslib_label_language')}</Label>
                <Select value={formData.language} onValueChange={(v) => setFormData({ ...formData, language: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('docslib_label_version')}</Label>
                <Input
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="v1.0"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('docslib_label_visibility')}</Label>
                <Select value={formData.visibility} onValueChange={(v) => setFormData({ ...formData, visibility: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIBILITIES.map(vis => (
                      <SelectItem key={vis.value} value={vis.value}>{vis.value === "public" ? t('docslib_visibility_public') : t('docslib_visibility_restricted')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('docslib_label_published_at')}</Label>
              <Input
                type="date"
                value={formData.published_at}
                onChange={(e) => setFormData({ ...formData, published_at: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t('docslib_btn_cancel')}
            </Button>
            <Button onClick={handleEdit}>
              {t('docslib_btn_save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('docslib_delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('docslib_delete_confirm_prefix')}"{selectedDocument?.title}"{t('docslib_delete_confirm_suffix')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('docslib_btn_cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('docslib_btn_delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {selectedDocument?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-[70vh] border rounded-lg"
                title={t('docslib_preview_iframe_title')}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              {t('docslib_btn_close')}
            </Button>
            <Button onClick={() => selectedDocument && handleDownload(selectedDocument)}>
              <Download className="h-4 w-4 mr-2" />
              {t('docslib_btn_download')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminDocumentLibrary;
