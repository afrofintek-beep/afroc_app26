import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, FileText, Upload, CheckCircle2, Clock, Eye, Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AfrolocRecord = Database["public"]["Tables"]["afroloc_records"]["Row"];
type IdentityDocument = Database["public"]["Tables"]["identity_documents"]["Row"];

interface DocumentType {
  id: string;
  title: string;
  description: string;
  required: boolean;
  acceptedFormats: string[];
}

const fileSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, "File size must be less than 5MB")
    .refine(
      (file) => ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type),
      "Only JPG, PNG, WEBP, and PDF files are allowed"
    ),
});

export default function DocumentVerification() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<AfrolocRecord | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<IdentityDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const documentTypes: DocumentType[] = [
    {
      id: "national_id",
      title: t("docverif_doc_national_id_title"),
      description: t("docverif_doc_national_id_desc"),
      required: true,
      acceptedFormats: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    },
    {
      id: "utility_bill",
      title: t("docverif_doc_utility_bill_title"),
      description: t("docverif_doc_utility_bill_desc"),
      required: true,
      acceptedFormats: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    },
    {
      id: "residence_certificate",
      title: t("docverif_doc_residence_cert_title"),
      description: t("docverif_doc_residence_cert_desc"),
      required: false,
      acceptedFormats: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    },
    {
      id: "property_deed",
      title: t("docverif_doc_property_deed_title"),
      description: t("docverif_doc_property_deed_desc"),
      required: false,
      acceptedFormats: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    },
  ];

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      const { data: recordData, error: recordError } = await supabase
        .from("afroloc_records")
        .select("*")
        .eq("id", id)
        .single();

      if (recordError) throw recordError;
      setRecord(recordData);

      // Load uploaded documents
      const { data: docsData, error: docsError } = await supabase
        .from("identity_documents")
        .select("*")
        .eq("afroloc_record_id", id)
        .order("created_at", { ascending: false });

      if (docsError) throw docsError;
      setUploadedDocuments(docsData || []);
    } catch (error: any) {
      toast({
        title: t("docverif_toast_error_title"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Refresh only documents without triggering full loading state
  const refreshDocuments = async () => {
    try {
      const { data: docsData, error: docsError } = await supabase
        .from("identity_documents")
        .select("*")
        .eq("afroloc_record_id", id)
        .order("created_at", { ascending: false });

      if (docsError) throw docsError;
      setUploadedDocuments(docsData || []);
    } catch (error: any) {
      console.error("Error refreshing documents:", error);
    }
  };


  const handleFileChange = async (
    documentType: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.target;
    const file = input.files?.[0];

    const resetInput = () => {
      try {
        input.value = "";
      } catch {
        // ignore
      }
    };

    if (!file) {
      resetInput();
      return;
    }

    // Validate file
    try {
      fileSchema.parse({ file });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t("docverif_toast_invalid_file_title"),
          description: error.issues[0].message,
          variant: "destructive",
        });
      }
      resetInput();
      return;
    }

    setUploadingDoc(documentType);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("docverif_error_not_authenticated"));

      // Generate unique file path
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${id}/${documentType}_${Date.now()}.${fileExt}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("identity-documents")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Save document record to database
      const { error: dbError } = await supabase
        .from("identity_documents")
        .insert({
          afroloc_record_id: id!,
          user_id: user.id,
          document_type: documentType,
          file_path: fileName,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          status: "pending",
        });

      if (dbError) throw dbError;

      toast({
        title: t("docverif_toast_success_title"),
        description: t("docverif_toast_upload_success_desc"),
      });

      // Reload only documents without blocking UI
      refreshDocuments();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: t("docverif_toast_upload_failed_title"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingDoc(null);
      resetInput();
    }
  };

  const handleDeleteDocument = async (docId: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("identity-documents")
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("identity_documents")
        .delete()
        .eq("id", docId);

      if (dbError) throw dbError;

      toast({
        title: t("docverif_toast_success_title"),
        description: t("docverif_toast_delete_success_desc"),
      });

      await loadData();
    } catch (error: any) {
      toast({
        title: t("docverif_toast_error_title"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewDocument = async (filePath: string) => {
    try {
      const { data } = supabase.storage
        .from("identity-documents")
        .getPublicUrl(filePath);

      if (data?.publicUrl) {
        // For private buckets, we need to create a signed URL
        const { data: signedData, error } = await supabase.storage
          .from("identity-documents")
          .createSignedUrl(filePath, 60); // 60 seconds

        if (error) throw error;

        window.open(signedData.signedUrl, "_blank");
      }
    } catch (error: any) {
      toast({
        title: t("docverif_toast_error_title"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getDocumentStatus = (docType: string): "pending" | "uploaded" | "verified" => {
    const doc = uploadedDocuments.find(d => d.document_type === docType);
    if (!doc) return "pending";
    if (doc.status === "verified") return "verified";
    return "uploaded";
  };

  const getStatusIcon = (status: "pending" | "uploaded" | "verified") => {
    switch (status) {
      case "verified":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "uploaded":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge variant="default" className="bg-green-600">{t("docverif_badge_verified")}</Badge>;
      case "pending":
        return <Badge variant="secondary">{t("docverif_badge_pending_review")}</Badge>;
      case "rejected":
        return <Badge variant="destructive">{t("docverif_badge_rejected")}</Badge>;
      default:
        return null;
    }
  };

  if (!record) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t("docverif_loading")}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <section className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/identity/${id}/verify`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("docverif_page_title")}</h1>
            <p className="text-muted-foreground">{t("docverif_page_subtitle")} {record.code}</p>
          </div>
        </header>

        {uploadedDocuments.length > 0 && (
          <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-900 dark:text-green-100">{t("docverif_uploaded_card_title")}</p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {t("docverif_uploaded_card_count_prefix")} {uploadedDocuments.length}{" "}
                    {uploadedDocuments.length !== 1
                      ? t("docverif_uploaded_card_documents_plural")
                      : t("docverif_uploaded_card_document_singular")}
                    . {t("docverif_uploaded_card_review_note")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {documentTypes.map((doc) => {
            const status = getDocumentStatus(doc.id);
            const uploadedDocs = uploadedDocuments.filter((d) => d.document_type === doc.id);

            return (
              <Card key={doc.id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {getStatusIcon(status)}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                          {doc.title}
                          {doc.required && (
                            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-normal">
                              {t("docverif_required_badge")}
                            </span>
                          )}
                        </CardTitle>
                        <CardDescription>{doc.description}</CardDescription>

                        {uploadedDocs.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {uploadedDocs.map((uploadedDoc) => (
                              <div
                                key={uploadedDoc.id}
                                className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50"
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{uploadedDoc.file_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {(uploadedDoc.file_size / 1024).toFixed(1)} KB
                                    </p>
                                  </div>
                                  {getStatusBadge(uploadedDoc.status)}
                                </div>
                                <div className="flex items-center gap-1 ml-2">
                                  <Button variant="ghost" size="sm" onClick={() => handleViewDocument(uploadedDoc.file_path)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {uploadedDoc.status === "pending" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteDocument(uploadedDoc.id, uploadedDoc.file_path)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="sm:ml-4 flex-shrink-0">
                      <Button
                        variant={status === "uploaded" ? "secondary" : "outline"}
                        size="sm"
                        disabled={uploadingDoc === doc.id}
                        className="relative overflow-hidden whitespace-nowrap w-full sm:w-auto"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {uploadingDoc === doc.id
                          ? t("docverif_btn_uploading")
                          : status === "uploaded"
                            ? t("docverif_btn_replace")
                            : t("docverif_btn_upload")}
                        <input
                          type="file"
                          accept={doc.acceptedFormats.join(",")}
                          onChange={(e) => handleFileChange(doc.id, e)}
                          disabled={uploadingDoc === doc.id}
                          aria-label={`${t("docverif_btn_upload")} ${doc.title}`}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                        />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("docverif_guidelines_title")}</CardTitle>
            <CardDescription>{t("docverif_guidelines_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <h4 className="font-medium">{t("docverif_guidelines_formats_heading")}</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>{t("docverif_guidelines_format_pdf")}</li>
                <li>{t("docverif_guidelines_format_images")}</li>
                <li>{t("docverif_guidelines_format_scanned")}</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t("docverif_guidelines_requirements_heading")}</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>{t("docverif_guidelines_req_valid")}</li>
                <li>{t("docverif_guidelines_req_name_address")}</li>
                <li>{t("docverif_guidelines_req_utility_recent")}</li>
                <li>{t("docverif_guidelines_req_legible")}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>
    </DashboardLayout>
  );
}
