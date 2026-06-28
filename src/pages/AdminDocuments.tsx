import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, FileText, CheckCircle2, XCircle, Clock, Eye, Search, Filter, ArrowLeft } from "lucide-react";
import { LevelGate } from "@/components/LevelGate";
import type { Database } from "@/integrations/supabase/types";

type IdentityDocument = Database["public"]["Tables"]["identity_documents"]["Row"];

interface DocumentWithDetails extends IdentityDocument {
  afroloc_code?: string;
  user_email?: string;
}

export default function AdminDocuments() {
  const [documents, setDocuments] = useState<DocumentWithDetails[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<DocumentWithDetails | null>(null);
  const [actionDialog, setActionDialog] = useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "verified" | "rejected">("all");
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  useEffect(() => {
    filterDocuments();
  }, [documents, searchQuery, statusFilter]);

  const checkAuthAndLoadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return;
    }
    loadDocuments();
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);

      // Get all documents with related AFROLOC records
      const { data: docsData, error: docsError } = await supabase
        .from("identity_documents")
        .select(`
          *,
          afroloc_records!inner(code, user_id)
        `)
        .order("created_at", { ascending: false });

      if (docsError) throw docsError;

      // Fetch user emails for each document
      const docsWithDetails: DocumentWithDetails[] = await Promise.all(
        (docsData || []).map(async (doc: any) => {
          const { data: userData } = await supabase.auth.admin.getUserById(doc.user_id);
          return {
            ...doc,
            afroloc_code: doc.afroloc_records?.code,
            user_email: userData?.user?.email || "Unknown",
          };
        })
      );

      setDocuments(docsWithDetails);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterDocuments = () => {
    let filtered = documents;

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(doc => doc.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(doc =>
        doc.afroloc_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.document_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredDocuments(filtered);
  };

  const handleViewDocument = async (doc: DocumentWithDetails) => {
    try {
      const { data: signedData, error } = await supabase.storage
        .from("identity-documents")
        .createSignedUrl(doc.file_path, 300); // 5 minutes

      if (error) throw error;

      setDocumentPreview(signedData.signedUrl);
      setSelectedDoc(doc);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleApprove = async () => {
    if (!selectedDoc) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("identity_documents")
        .update({
          status: "verified",
          verified_at: new Date().toISOString(),
          verified_by_user_id: user.id,
          rejection_reason: null,
        })
        .eq("id", selectedDoc.id);

      if (error) throw error;

      // Send approval email
      try {
        await supabase.functions.invoke("send-document-status-email", {
          body: {
            user_email: selectedDoc.user_email,
            afroloc_code: selectedDoc.afroloc_code,
            document_type: selectedDoc.document_type,
            status: "verified",
          },
        });
      } catch (emailError) {
        console.error("Failed to send approval email:", emailError);
        // Don't fail the approval if email fails
      }

      toast({
        title: "Success",
        description: "Document approved successfully",
      });

      setActionDialog(null);
      setSelectedDoc(null);
      setDocumentPreview(null);
      await loadDocuments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (!selectedDoc || !rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("identity_documents")
        .update({
          status: "rejected",
          verified_by_user_id: user.id,
          rejection_reason: rejectionReason,
        })
        .eq("id", selectedDoc.id);

      if (error) throw error;

      // Send rejection email
      try {
        await supabase.functions.invoke("send-document-status-email", {
          body: {
            user_email: selectedDoc.user_email,
            afroloc_code: selectedDoc.afroloc_code,
            document_type: selectedDoc.document_type,
            status: "rejected",
            rejection_reason: rejectionReason,
          },
        });
      } catch (emailError) {
        console.error("Failed to send rejection email:", emailError);
        // Don't fail the rejection if email fails
      }

      toast({
        title: "Success",
        description: "Document rejected",
      });

      setActionDialog(null);
      setSelectedDoc(null);
      setDocumentPreview(null);
      setRejectionReason("");
      await loadDocuments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge variant="default" className="bg-green-600">Verified</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending Review</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return null;
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      national_id: "National ID Card",
      utility_bill: "Utility Bill",
      residence_certificate: "Residence Certificate",
      property_deed: "Property Deed/Lease",
    };
    return labels[type] || type;
  };

  const getStatusCount = (status: string) => {
    return documents.filter(doc => doc.status === status).length;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <LevelGate requiredLevel={2}>
        <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex items-start gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/dashboard")}
                  className="flex-shrink-0 mt-1"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                    <Shield className="h-8 w-8" />
                    Document Review
                  </h1>
                  <p className="text-muted-foreground">Review and manage identity document submissions</p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Documents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{documents.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">{getStatusCount("pending")}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Verified</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{getStatusCount("verified")}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{getStatusCount("rejected")}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by AFROLOC, email, or document type..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="w-auto">
                        <TabsList>
                          <TabsTrigger value="all">All</TabsTrigger>
                          <TabsTrigger value="pending">Pending</TabsTrigger>
                          <TabsTrigger value="verified">Verified</TabsTrigger>
                          <TabsTrigger value="rejected">Rejected</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Documents List */}
              <Card>
                <CardHeader>
                  <CardTitle>Document Submissions</CardTitle>
                  <CardDescription>
                    {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''} found
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredDocuments.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No documents found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold">{getDocumentTypeLabel(doc.document_type)}</h3>
                                {getStatusBadge(doc.status)}
                              </div>
                              <div className="mt-1 space-y-1">
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-medium">AFROLOC:</span>{" "}
                                  <span className="font-mono">{doc.afroloc_code}</span>
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-medium">User:</span> {doc.user_email}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-medium">File:</span> {doc.file_name}{" "}
                                  <span className="text-xs">({(doc.file_size / 1024).toFixed(1)} KB)</span>
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-medium">Uploaded:</span>{" "}
                                  {new Date(doc.created_at).toLocaleString()}
                                </p>
                                {doc.rejection_reason && (
                                  <p className="text-sm text-destructive">
                                    <span className="font-medium">Rejection Reason:</span> {doc.rejection_reason}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDocument(doc)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Review
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </LevelGate>

          {/* Document Preview Dialog */}
          <Dialog open={!!documentPreview} onOpenChange={() => {
        setDocumentPreview(null);
        setSelectedDoc(null);
        setActionDialog(null);
        setRejectionReason("");
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Document Review</DialogTitle>
            <DialogDescription>
              {selectedDoc && (
                <>
                  {getDocumentTypeLabel(selectedDoc.document_type)} for {selectedDoc.afroloc_code}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {documentPreview && (
              <div className="rounded-lg border border-border overflow-hidden bg-muted">
                {selectedDoc?.mime_type === "application/pdf" ? (
                  <iframe
                    src={documentPreview}
                    className="w-full h-[500px]"
                    title="Document Preview"
                  />
                ) : (
                  <img
                    src={documentPreview}
                    alt="Document"
                    className="w-full h-auto max-h-[500px] object-contain"
                  />
                )}
              </div>
            )}

            {selectedDoc?.status === "pending" && (
              <div className="flex gap-4">
                <Button
                  onClick={() => setActionDialog("approve")}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve Document
                </Button>
                <Button
                  onClick={() => setActionDialog("reject")}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject Document
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation Dialog */}
      <Dialog open={actionDialog === "approve"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this document? This action will mark it as verified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog with Reason */}
      <Dialog open={actionDialog === "reject"} onOpenChange={() => {
        setActionDialog(null);
        setRejectionReason("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Document</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this document. The user will see this message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejection_reason">Rejection Reason *</Label>
              <Textarea
                id="rejection_reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Document is blurry, expired, or doesn't match the address..."
                rows={4}
                maxLength={500}
              />
              <p className="text-sm text-muted-foreground">
                {rejectionReason.length}/500 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setActionDialog(null);
              setRejectionReason("");
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              variant="destructive"
              disabled={!rejectionReason.trim()}
            >
              <XCircle className="mr-2 h-4 w-4" />
            Reject Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </DashboardLayout>
  );
}
