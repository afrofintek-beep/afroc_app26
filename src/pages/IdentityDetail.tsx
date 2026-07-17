import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MapPin, CheckCircle2, Clock, Award, Users, ArrowLeft, UserPlus, Shield, FileText, CheckCircle, Download, AlertCircle, Star, Camera, ImageIcon, History, Trash2, Home, Mailbox } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Database } from "@/integrations/supabase/types";
import jsPDF from "jspdf";
import { ATSScoreCard } from "@/components/ATSScoreCard";
import { ATSScoreBadge } from "@/components/ATSScoreBadge";
import { GPSSpoofingAlert } from "@/components/GPSSpoofingAlert";
import { AddressTypeBadge } from "@/components/AddressTypeBadge";
import { PrimaryResidenceBadge } from "@/components/PrimaryResidenceBadge";
import { PropertyPhotoDisplay } from "@/components/PropertyPhotoDisplay";
import { VerificationStatusBar } from "@/components/VerificationStatusBar";
import { VerificationCycleIndicator } from "@/components/VerificationCycleIndicator";
import { GPSHistoryTimeline } from "@/components/GPSHistoryTimeline";
import { ResidentsTab } from "@/components/ResidentsTab";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuthorizationLevel } from "@/hooks/useAuthorizationLevel";
import { postalFrom } from "@/lib/postal";

type AfrolocRecord = Database["public"]["Tables"]["afroloc_records"]["Row"];
type AfrolocWitness = Database["public"]["Tables"]["afroloc_witnesses"]["Row"];
type IdentityDocument = Database["public"]["Tables"]["identity_documents"]["Row"];

export default function IdentityDetail() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<AfrolocRecord | null>(null);
  const [witnesses, setWitnesses] = useState<AfrolocWitness[]>([]);
  const [documents, setDocuments] = useState<IdentityDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [postalBox, setPostalBox] = useState<{ station: string; box_number: string; tier: string } | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { data: authLevel } = useAuthorizationLevel();
  const [deleting, setDeleting] = useState(false);
  
  // Only show technical GPS details to high-level admins (level 4+) for auditing
  const userLevel = authLevel?.current_level || 1;
  const canViewAuditDetails = userLevel >= 4;

  // Check if record can be deleted (only drafts)
  const canDelete = record?.status === "draft";

  const scrollToSection = (sectionId: string, tab?: string) => {
    if (tab) {
      setActiveTab(tab);
    }
    setTimeout(() => {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleDeleteAddress = async () => {
    if (!id || !canDelete) return;
    
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('address-gateway', {
        body: {
          action: 'delete',
          recordId: id,
        },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Delete failed');

      toast({
        title: t('common.success'),
        description: t('address_deleted_success') || t('identitydetail_address_deleted_success'),
      });
      navigate("/my-addresses");
    } catch (error: any) {
      console.error("Error deleting address:", error);
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    checkAuthAndLoadData();
  }, [id]);

  const checkAuthAndLoadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/login");
      return;
    }

    setCurrentUserId(session.user.id);
    loadIdentityData();
  };

  const loadIdentityData = async () => {
    try {
      // Load record
      const { data: recordData, error: recordError } = await supabase
        .from("afroloc_records")
        .select("*")
        .eq("id", id)
        .single();

      if (recordError) throw recordError;
      setRecord(recordData);

      // Load witnesses
      const { data: witnessData, error: witnessError } = await supabase
        .from("afroloc_witnesses")
        .select("*")
        .eq("afroloc_record_id", id)
        .order("created_at", { ascending: false });

      if (witnessError) throw witnessError;
      setWitnesses(witnessData || []);

      // Load documents
      const { data: documentsData, error: documentsError } = await supabase
        .from("identity_documents")
        .select("*")
        .eq("afroloc_record_id", id)
        .order("created_at", { ascending: false });

      if (documentsError) throw documentsError;
      setDocuments(documentsData || []);

      // Load Caixa Postal (se atribuída a este endereço). RLS: só o dono vê a sua.
      // (Tabela recente — ainda fora dos tipos gerados; consulta sem tipar.)
      const { data: boxData } = await (supabase as any)
        .from("postal_boxes")
        .select("station, box_number, tier")
        .eq("entity_id", id)
        .maybeSingle();
      setPostalBox(boxData ?? null);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "certified":
        return <Award className="h-4 w-4" />;
      case "verified":
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "certified":
        return "default";
      case "verified":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getWitnessStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "confirmed":
        return "default";
      case "pending":
        return "outline";
      case "rejected":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getDocumentStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge variant="default" className="bg-green-600">{t('doc_status_verified')}</Badge>;
      case "pending":
        return <Badge variant="secondary">{t('doc_status_pending')}</Badge>;
      case "rejected":
        return <Badge variant="destructive">{t('doc_status_rejected')}</Badge>;
      default:
        return null;
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      national_id: t('doc_type_national_id'),
      utility_bill: t('doc_type_utility_bill'),
      residence_certificate: t('doc_type_residence_certificate'),
      property_deed: t('doc_type_property_deed'),
    };
    return labels[type] || type;
  };

  const getTranslatedStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      draft: t('status_draft'),
      pending: t('status_pending'),
      verified: t('status_verified'),
      certified: t('status_certified'),
      confirmed: t('status_confirmed'),
      rejected: t('status_rejected'),
    };
    return statusMap[status] || status;
  };

  const generateWitnessContractPDF = async (witness: AfrolocWitness) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let yPosition = 20;

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("WITNESS LEGAL CONTRACT", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 15;

    // Document ID
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Contract ID: ${witness.id}`, pageWidth / 2, yPosition, { align: "center" });
    yPosition += 15;

    // Divider line
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Identity Information Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("IDENTITY INFORMATION", margin, yPosition);
    yPosition += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`AFROLOC: ${record?.code || 'N/A'}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Address: ${record?.level4_name || ''}, ${record?.street_name || ''} #${record?.number || ''}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Location: ${record?.level2_name || ''}, ${record?.level1_name || ''}, ${record?.country || ''}`, margin, yPosition);
    yPosition += 12;

    // Witness Information Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("WITNESS INFORMATION", margin, yPosition);
    yPosition += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Witness AFROLOC: ${witness.witness_afro_id}`, margin, yPosition);
    yPosition += 6;
    
    const fullName = witness.signature.split(' - ')[0] || 'N/A';
    doc.text(`Full Name: ${fullName}`, margin, yPosition);
    yPosition += 6;
    
    if (witness.confirmed_at) {
      doc.text(`Contract Signed: ${new Date(witness.confirmed_at).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      })}`, margin, yPosition);
      yPosition += 12;
    }

    // Legal Contract Text
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("LEGAL AGREEMENT", margin, yPosition);
    yPosition += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("TERMO DE COMPROMISSO DE TESTEMUNHA", margin, yPosition);
    yPosition += 8;

    doc.setFont("helvetica", "normal");
    const introText = "Eu, abaixo assinado, declaro para os devidos fins que:";
    doc.text(introText, margin, yPosition);
    yPosition += 8;

    const terms = [
      "1. Conheço pessoalmente o residente cujo endereço estou atestando;",
      "2. Confirmo que as informações de localização fornecidas são verdadeiras e corretas;",
      "3. Estou ciente de que este testemunho será usado para validação oficial de endereço no sistema AFROLOC;",
      "4. Compreendo que fornecer informações falsas pode resultar em consequências legais;",
      "5. Autorizo o uso desta declaração para fins de verificação de identidade e endereço;",
      "6. Assumo total responsabilidade pela veracidade das informações prestadas."
    ];

    terms.forEach(term => {
      const lines = doc.splitTextToSize(term, maxWidth);
      lines.forEach((line: string) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, margin, yPosition);
        yPosition += 6;
      });
      yPosition += 2;
    });

    yPosition += 5;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    const footerText = "Este termo é regido pelas leis aplicáveis e constitui um compromisso legal de veracidade das informações prestadas.";
    const footerLines = doc.splitTextToSize(footerText, maxWidth);
    footerLines.forEach((line: string) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, margin, yPosition);
      yPosition += 5;
    });

    // Signature Section
    yPosition += 10;
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 2;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("DIGITAL SIGNATURE", margin, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "italic");
    const signature = witness.signature.split(' - ')[1] || witness.signature;
    doc.text(signature, pageWidth / 2, yPosition, { align: "center" });
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Signed by: ${fullName}`, pageWidth / 2, yPosition, { align: "center" });
    yPosition += 5;
    if (witness.confirmed_at) {
      doc.text(`Date: ${new Date(witness.confirmed_at).toLocaleDateString()}`, pageWidth / 2, yPosition, { align: "center" });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("This document was digitally generated by AFROLOC System", pageWidth / 2, 285, { align: "center" });
    doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, 290, { align: "center" });

    // Save the PDF
    const fileName = `AFROLOC_Witness_Contract_${witness.witness_afro_id}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    toast({
      title: t('common.success'),
      description: t('witness_contract_downloaded'),
    });

    // Send notification to witness
    try {
      const { error } = await supabase.functions.invoke("notify-witness-contract-download", {
        body: {
          witness_id: witness.id,
          afroloc_code: record?.code || "N/A",
        },
      });

      if (error) {
        console.error("Failed to send notification:", error);
      } else {
        console.log("Notification sent to witness");
      }
    } catch (notificationError) {
      console.error("Notification error:", notificationError);
      // Don't show error to user as the PDF was downloaded successfully
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!record) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('identity_not_found')}</p>
          <Button onClick={() => navigate("/identities")} className="mt-4">
            {t('back_to_identities')}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const confirmedWitnesses = witnesses.filter(w => w.status === "confirmed").length;
  const requiredWitnesses = 3;
  const canBeVerified = confirmedWitnesses >= requiredWitnesses && record.status === "draft";

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/identities")} className="flex-shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground font-mono truncate">{record.code}</h1>
              <p className="text-sm sm:text-base text-muted-foreground truncate">
                {record.level4_name || record.level3_name || record.level2_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0 flex-wrap">
            <Badge
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity px-3 py-1.5 text-sm font-medium bg-blue-500/10 text-blue-500 border border-blue-500/50 hover:bg-blue-500/20"
              onClick={() => navigate(`/identity/${id}/edit`)}
            >
              <MapPin className="h-4 w-4" />
              {t('identitydetail_update')}
            </Badge>
            <ATSScoreBadge
              atsScore={record.ats_score}
              certificationLevel={record.certification_level}
              breakdown={record.ats_breakdown}
              size="md"
              onClick={() => scrollToSection('ats-score-section', 'details')}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant={getStatusVariant(record.status)} 
                    className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity px-3 py-1.5 text-sm font-medium"
                    onClick={() => scrollToSection('validations-section', 'validations')}
                  >
                    {getStatusIcon(record.status)}
                    {getTranslatedStatus(record.status)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <p className="font-medium">{t('status')}: {getTranslatedStatus(record.status)}</p>
                    <p className="text-xs text-muted-foreground">{t('click_to_view_validations') || 'Clique para ver validações'}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <PrimaryResidenceBadge 
              isPrimary={(record as any).is_primary_residence || false}
              size="md"
            />
            
            {/* Delete button - only for drafts */}
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Badge
                    variant="destructive"
                    className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity px-3 py-1.5 text-sm font-medium"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('common.delete') || 'Eliminar'}
                  </Badge>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('delete_address_title') || 'Eliminar Endereço'}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('delete_address_warning') || 'Tem certeza que deseja eliminar este endereço AFROLOC? Esta ação não pode ser desfeita.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel') || 'Cancelar'}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAddress}
                      disabled={deleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? (t('common.deleting') || 'A eliminar...') : (t('common.delete') || 'Eliminar')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Status Alert */}
        {canBeVerified && (
          <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-semibold text-green-900 dark:text-green-100 text-sm sm:text-base">
                      {t('ready_for_verification')}
                    </p>
                    <p className="text-xs sm:text-sm text-green-700 dark:text-green-300">
                      {t('ready_for_verification_description').replace('{count}', String(confirmedWitnesses))}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => navigate(`/identity/${id}/verify`)}
                  className="bg-green-600 hover:bg-green-700 w-full sm:w-auto flex-shrink-0"
                  size="sm"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  <span className="sm:inline">{t('start_verification')}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {record.status === "draft" && !canBeVerified && (
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-semibold text-blue-900 dark:text-blue-100 text-sm sm:text-base">
                      {t('verification_options_available')}
                    </p>
                    <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
                      {t('verification_options_description')}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => navigate(`/identity/${id}/verify`)}
                  variant="outline"
                  className="w-full sm:w-auto flex-shrink-0"
                  size="sm"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  <span className="sm:inline">{t('view_options')}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="details" className="text-xs sm:text-sm px-2 sm:px-3">{t('details')}</TabsTrigger>
            <TabsTrigger value="residents" className="text-xs sm:text-sm px-2 sm:px-3">
              <span className="hidden sm:inline">{t('residents')}</span>
              <span className="sm:hidden"><Home className="h-4 w-4" /></span>
            </TabsTrigger>
            <TabsTrigger value="witnesses" className="text-xs sm:text-sm px-2 sm:px-3">
              <span className="hidden sm:inline">{t('witnesses')} ({witnesses.length})</span>
              <span className="sm:hidden">T ({witnesses.length})</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs sm:text-sm px-2 sm:px-3">
              <span className="hidden sm:inline">{t('documents')} ({documents.length})</span>
              <span className="sm:hidden">D ({documents.length})</span>
            </TabsTrigger>
            <TabsTrigger value="validations" className="text-xs sm:text-sm px-2 sm:px-3">
              <span className="hidden sm:inline">{t('validations')}</span>
              <span className="sm:hidden">V</span>
            </TabsTrigger>
          </TabsList>

              {/* Residents Tab */}
              <TabsContent value="residents" className="space-y-6">
                <ResidentsTab
                  afrolocRecordId={id || ''}
                  afrolocCode={record.code}
                  propertyType={record.property_type}
                  isOwner={record.user_id === currentUserId}
                  currentUserId={currentUserId}
                />
              </TabsContent>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-6">
                {/* Verification Cycle Indicator - Semáforo Completo (apenas para endereços validados) */}
                <VerificationCycleIndicator
                  streetName={record.street_name}
                  number={record.number}
                  streetCode={record.street_code}
                  addressType={record.address_type}
                  propertyType={record.property_type}
                  status={record.status}
                  lastVerifiedAt={record.last_verified_at}
                  nextVerificationDue={record.next_verification_due}
                  geoLat={record.geo_lat}
                  geoLon={record.geo_lon}
                  gpsValidatedAt={record.gps_validated_at}
                  photoExifGpsLat={record.photo_exif_gps_lat}
                  photoExifGpsLon={record.photo_exif_gps_lon}
                  witnessCount={witnesses.length}
                  confirmedWitnessCount={confirmedWitnesses}
                  createdAt={record.created_at}
                />

                {/* ATS Score Card */}
                <div id="ats-score-section">
                <ATSScoreCard
                  atsScore={record.ats_score}
                  certificationLevel={record.certification_level}
                  breakdown={record.ats_breakdown}
                />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>{t('address_information')}</CardTitle>
                    <CardDescription>{t('hierarchical_address_structure')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t('country_label')}</label>
                        <p className="text-lg font-semibold">{record.country}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t('province_state')}</label>
                        <p className="text-lg">{record.level1_name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t('municipality_label')}</label>
                        <p className="text-lg">{record.level2_name}</p>
                      </div>
                      {record.level3_name && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">{t('commune_label')}</label>
                          <p className="text-lg">{record.level3_name}</p>
                        </div>
                      )}
                      {record.level4_name && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">{t('neighborhood_label')}</label>
                          <p className="text-lg">{record.level4_name}</p>
                        </div>
                      )}
                      {(record as any).property_name && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                            {t('identitydetail_property_name')}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-600 dark:text-amber-400">
                                    <AlertCircle className="h-3 w-3 mr-0.5" />
                                    {t('identitydetail_not_verified')}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs max-w-[200px]">{t('identitydetail_property_name_tooltip')}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </label>
                          <p className="text-lg italic text-muted-foreground">{(record as any).property_name}</p>
                        </div>
                      )}
                      {record.street_name && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">{t('street_label')}</label>
                          <p className="text-lg">{record.street_name}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t('number_label')}</label>
                        <p className="text-lg">{record.number}</p>
                      </div>
                      {record.unit && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">{t('unit_label')}</label>
                          <p className="text-lg">{record.unit}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Correios — Código Postal (CEP) + Caixa Postal */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mailbox className="h-5 w-5" />
                      {t('postal_card_title')}
                    </CardTitle>
                    <CardDescription>{t('postal_card_desc')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t('postal_cep_label')}</label>
                        <p className="text-lg font-mono">{postalFrom(record.level1_code || "", record.level2_code || "", record.code).cep}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t('postal_cep_hint')}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t('postal_box_label')}</label>
                        {postalBox ? (
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-lg font-mono">{postalBox.station}-{postalBox.box_number}</p>
                            <Badge variant={postalBox.tier === "premium" ? "default" : "secondary"} className="text-[10px]">
                              {postalBox.tier === "premium" ? t('postal_tier_premium') : t('postal_tier_standard')}
                            </Badge>
                          </div>
                        ) : (
                          <p className="text-lg text-muted-foreground italic">{t('postal_box_none')}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {record.geo_lat && record.geo_lon && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        {t('position_card_title')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                          <p className="text-sm font-medium text-foreground">{t('position_cell_masked_title')}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t('position_cell_masked_hint')}</p>
                        </div>

                        {/* Property Photo for GPS Validation */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Camera className="h-4 w-4" />
                            {t('property_photo') || 'Foto da Propriedade'}
                          </label>
                          <div className="relative rounded-lg overflow-hidden border border-border bg-muted/50">
                            <PropertyPhotoDisplay 
                              filePath={(record.photo_metadata as { file_path?: string })?.file_path || ''}
                              afrolocRecordId={record.id}
                              allowRecapture={true}
                              onPhotoUpdated={loadIdentityData}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t('photo_used_position_validation')}
                          </p>
                        </div>
                        
                        {/* GPS Validation Status - Public view for regular users, detailed for auditors */}
                        <GPSSpoofingAlert
                          deviceGPS={{
                            latitude: Number(record.geo_lat),
                            longitude: Number(record.geo_lon)
                          }}
                          exifGPS={record.photo_exif_gps_lat && record.photo_exif_gps_lon ? {
                            latitude: Number(record.photo_exif_gps_lat),
                            longitude: Number(record.photo_exif_gps_lon)
                          } : null}
                          exifTimestamp={record.photo_exif_timestamp}
                          showDetails={canViewAuditDetails}
                          publicView={!canViewAuditDetails}
                          contactInfo="+244 923 456 789"
                        />
                        
                        {/* Abre a ZONA (célula ~10 m), não a posição exata: coordenadas coarsened p/ 4 casas. */}
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => window.open(`https://www.google.com/maps?q=${Number(record.geo_lat).toFixed(4)},${Number(record.geo_lon).toFixed(4)}`, "_blank")}
                        >
                          <MapPin className="mr-2 h-4 w-4" />
                          {t('view_zone_on_map')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* GPS History Timeline */}
                {id && (
                  <GPSHistoryTimeline afrolocRecordId={id} />
                )}
              </TabsContent>

          {/* Witnesses Tab */}
          <TabsContent value="witnesses" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                      <Users className="h-5 w-5 flex-shrink-0" />
                      <span className="truncate">{t('community_witnesses')}</span>
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm mt-1">
                      {t('witnesses_confirmed_count').replace('{confirmed}', String(confirmedWitnesses)).replace('{required}', String(requiredWitnesses))}
                    </CardDescription>
                  </div>
                  {record.status === "draft" && (
                    <Button onClick={() => navigate(`/identity/${id}/add-witness`)} className="w-full sm:w-auto flex-shrink-0" size="sm">
                      <UserPlus className="mr-2 h-4 w-4" />
                      {t('add_witness')}
                    </Button>
                  )}
                </div>
                
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground font-medium">{t('verification_progress')}</span>
                    <span className="font-semibold text-foreground">
                      {confirmedWitnesses}/{requiredWitnesses}
                    </span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        confirmedWitnesses >= requiredWitnesses 
                          ? 'bg-green-600' 
                          : 'bg-primary'
                      }`}
                      style={{ width: `${(confirmedWitnesses / requiredWitnesses) * 100}%` }}
                    />
                  </div>
                  {confirmedWitnesses < requiredWitnesses && (
                    <div className="flex items-start gap-2 p-2.5 sm:p-3 rounded-lg bg-muted/50 border border-border">
                      <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed break-words">
                        {(requiredWitnesses - confirmedWitnesses > 1
                          ? t('identitydetail_witnesses_needed_plural')
                          : t('identitydetail_witnesses_needed_singular')
                        ).replace('{count}', String(requiredWitnesses - confirmedWitnesses))}
                      </p>
                    </div>
                  )}
                  {confirmedWitnesses >= requiredWitnesses && (
                    <div className="flex items-start gap-2 p-2.5 sm:p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed font-medium break-words">
                        {t('identitydetail_all_witnesses_confirmed').replace('{count}', String(requiredWitnesses))}
                      </p>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                {witnesses.length === 0 ? (
                  <div className="text-center py-6 sm:py-8">
                    <Users className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                    <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">{t('no_witnesses_yet')}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 px-4">
                      {t('witnesses_required_message').replace('{count}', String(requiredWitnesses))}
                    </p>
                    <Button onClick={() => navigate(`/identity/${id}/add-witness`)} size="sm" className="w-full sm:w-auto">
                      <UserPlus className="mr-2 h-4 w-4" />
                      {t('add_first_witness')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {witnesses.map((witness) => (
                      <Card key={witness.id} className="border-border">
                        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                          <div className="space-y-3 sm:space-y-4">
                            {/* Header with Status */}
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                                {witness.status === "confirmed" ? (
                                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                                  </div>
                                ) : (
                                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold font-mono text-sm sm:text-base break-all">{witness.witness_afro_id}</p>
                                  <p className="text-xs sm:text-sm text-muted-foreground">
                                    {t('added_on')} {new Date(witness.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <Badge variant={getWitnessStatusVariant(witness.status)} className="self-start sm:self-auto flex-shrink-0 text-xs">
                                {getTranslatedStatus(witness.status)}
                              </Badge>
                            </div>

                            {/* Contract & Signature Details (only for confirmed witnesses) */}
                            {witness.status === "confirmed" && witness.signature && (
                              <div className="rounded-lg border border-green-200 dark:border-green-900/30 bg-green-50 dark:bg-green-900/10 p-3 sm:p-4 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 min-w-0">
                                    <FileText className="h-4 w-4 flex-shrink-0" />
                                    <span className="font-semibold text-xs sm:text-sm truncate">{t('signed_legal_contract')}</span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => generateWitnessContractPDF(witness)}
                                    className="gap-2 w-full sm:w-auto flex-shrink-0"
                                  >
                                    <Download className="h-4 w-4" />
                                    <span className="text-xs sm:text-sm">{t('download_pdf')}</span>
                                  </Button>
                                </div>
                                
                                <div className="space-y-3">
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">{t('witness_signature')}</label>
                                    <p className="text-xs sm:text-sm font-medium italic bg-background rounded px-2 sm:px-3 py-2 border border-border break-all">
                                      {witness.signature.split(' - ')[1] || witness.signature}
                                    </p>
                                  </div>

                                  {witness.confirmed_at && (
                                    <div className="space-y-1">
                                      <label className="text-xs font-medium text-muted-foreground">{t('contract_signed_on')}</label>
                                      <p className="text-xs sm:text-sm font-medium break-words">
                                        {new Date(witness.confirmed_at).toLocaleString('en-US', {
                                          year: 'numeric',
                                          month: 'long',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </p>
                                    </div>
                                  )}

                                  <div className="pt-2 border-t border-green-200 dark:border-green-900/30">
                                    <p className="text-xs text-muted-foreground leading-relaxed break-words">
                                      {t('witness_contract_legal_note')}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Pending Status Message */}
                            {witness.status === "pending" && (
                              <div className="rounded-lg border border-border bg-muted/50 p-2.5 sm:p-3">
                                <p className="text-xs sm:text-sm text-muted-foreground flex items-start gap-2">
                                  <Clock className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                  <span className="break-words">{t('waiting_for_witness_confirmation')}</span>
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

              {/* Validations Tab */}
              <TabsContent value="validations" className="space-y-6">
                <Card id="validations-section">
                  <CardHeader>
                    <CardTitle>{t('validation_history')}</CardTitle>
                    <CardDescription>{t('authority_confirmations_certifications')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <Award className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">{t('no_validations_yet')}</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {t('once_witnesses_confirm_authority_validate')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Shield className="h-5 w-5" />
                          {t('identity_documents')}
                        </CardTitle>
                        <CardDescription>
                          {t('upload_manage_documents_desc')}
                        </CardDescription>
                      </div>
                      <Button onClick={() => navigate(`/identity/${id}/document-verification`)}>
                        {t('upload_document')}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {documents.length === 0 ? (
                      <div className="text-center py-8">
                        <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground mb-4">{t('no_documents_uploaded_yet')}</p>
                        <p className="text-sm text-muted-foreground mb-6">
                          {t('upload_documents_to_verify')}
                        </p>
                        <Button onClick={() => navigate(`/identity/${id}/document-verification`)}>
                          {t('upload_first_document')}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="rounded-lg border border-border p-4 space-y-3"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold">{getDocumentTypeLabel(doc.document_type)}</h3>
                                  {getDocumentStatusBadge(doc.status)}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {doc.file_name} ({(doc.file_size / 1024).toFixed(1)} KB)
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {t('uploaded_on')} {new Date(doc.created_at).toLocaleDateString()}
                                </p>
                                {doc.verified_at && (
                                  <p className="text-sm text-green-600 dark:text-green-400">
                                    {t('verified_on')} {new Date(doc.verified_at).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            {doc.status === "rejected" && doc.rejection_reason && (
                              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                                <p className="text-sm font-medium text-destructive mb-1">
                                  {t('rejection_reason')}:
                                </p>
                                <p className="text-sm text-destructive/90">
                                  {doc.rejection_reason}
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-3"
                                  onClick={() => navigate(`/identity/${id}/document-verification`)}
                                >
                                  {t('upload_new_document')}
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
