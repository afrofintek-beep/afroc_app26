import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Users, Shield, FileText, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { LevelGate } from "@/components/LevelGate";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Database } from "@/integrations/supabase/types";

type AfrolocRecord = Database["public"]["Tables"]["afroloc_records"]["Row"];
type AfrolocWitness = Database["public"]["Tables"]["afroloc_witnesses"]["Row"];

interface VerificationMethod {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: "available" | "in-progress" | "completed" | "locked";
  requiredLevel: number;
  action: () => void;
}

export default function VerifyIdentity() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<AfrolocRecord | null>(null);
  const [witnesses, setWitnesses] = useState<AfrolocWitness[]>([]);
  const [authorityValidations, setAuthorityValidations] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
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

      const { data: witnessData } = await supabase
        .from("afroloc_witnesses")
        .select("*")
        .eq("afroloc_record_id", id);

      setWitnesses(witnessData || []);

      // Load authority validations
      const { data: validationsData } = await supabase
        .from("afroloc_validations")
        .select("*")
        .eq("afroloc_record_id", id);

      setAuthorityValidations(validationsData || []);

      // Load identity documents
      const { data: documentsData } = await supabase
        .from("identity_documents")
        .select("*")
        .eq("afroloc_record_id", id);

      setDocuments(documentsData || []);
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

  const handleCommunityVerification = () => {
    navigate(`/identity/${id}?tab=witnesses`);
  };

  const handleAuthorityValidation = () => {
    navigate(`/identity/${id}/authority-validation`);
  };

  const handleDocumentVerification = () => {
    navigate(`/identity/${id}/document-verification`);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!record) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t('no_record_found_title')}</h2>
          <p className="text-muted-foreground mb-6 max-w-md">{t('no_record_found_desc')}</p>
          <Button onClick={() => navigate('/identities')} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('back_to_identities')}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const confirmedWitnesses = witnesses.filter(w => w.status === "confirmed").length;
  const requiredWitnesses = 2; // Updated to match min_witnesses_required from countries table
  const hasEnoughWitnesses = confirmedWitnesses >= requiredWitnesses;
  
  const hasAuthorityValidation = authorityValidations.length > 0;
  const verifiedDocuments = documents.filter(d => d.status === "verified").length;
  const hasDocuments = verifiedDocuments > 0;

  const verificationMethods: VerificationMethod[] = [
    {
      id: "community",
      title: t('community_verification_required'),
      description: t('community_verification_desc')
        .replace('{count}', String(requiredWitnesses))
        .replace('{confirmed}', String(confirmedWitnesses))
        .replace('{total}', String(requiredWitnesses)),
      icon: <Users className="h-8 w-8" />,
      status: hasEnoughWitnesses ? "completed" : witnesses.length > 0 ? "in-progress" : "available",
      requiredLevel: 1,
      action: handleCommunityVerification,
    },
    {
      id: "authority",
      title: t('authority_validation_required'),
      description: hasAuthorityValidation 
        ? t('authority_validation_completed').replace('{count}', String(authorityValidations.length))
        : t('authority_validation_desc'),
      icon: <Shield className="h-8 w-8" />,
      status: hasAuthorityValidation ? "completed" : "available",
      requiredLevel: 2,
      action: handleAuthorityValidation,
    },
    {
      id: "document",
      title: t('document_verification_required'),
      description: hasDocuments
        ? t('documents_verified').replace('{count}', String(verifiedDocuments))
        : t('document_verification_desc'),
      icon: <FileText className="h-8 w-8" />,
      status: hasDocuments ? "completed" : "available",
      requiredLevel: 1,
      action: handleDocumentVerification,
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "in-progress":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case "locked":
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-600">{t('status_completed')}</Badge>;
      case "in-progress":
        return <Badge variant="secondary">{t('status_in_progress')}</Badge>;
      case "locked":
        return <Badge variant="outline">{t('status_locked')}</Badge>;
      default:
        return <Badge variant="outline">{t('status_available')}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full max-w-5xl mx-auto space-y-4 sm:space-y-6 px-0">
        <div className="flex items-start gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/identity/${id}`)} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground break-words">{t('verify_identity')}</h1>
            <p className="text-muted-foreground text-sm sm:text-base break-words">{t('verify_identity_subtitle')} {record.code}</p>
          </div>
        </div>

        {/* Required Verification Notice */}
        {(!hasAuthorityValidation || !hasDocuments) && (
          <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex items-start gap-2 sm:gap-3">
                <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-orange-900 dark:text-orange-100 text-sm sm:text-base">
                    {t('pending_required_validations')}
                  </p>
                  <p className="text-xs sm:text-sm text-orange-700 dark:text-orange-300 break-words mt-1">
                    {t('pending_validations_intro')}
                  </p>
                  <ul className="text-xs sm:text-sm text-orange-700 dark:text-orange-300 list-disc list-inside mt-2 space-y-1">
                    {!hasAuthorityValidation && (
                      <li><strong>{t('authority_validation')}</strong> - {t('pending_authority_validation')}</li>
                    )}
                    {!hasDocuments && (
                      <li><strong>{t('document_verification')}</strong> - {t('pending_document_verification')}</li>
                    )}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {record.status === "verified" || record.status === "certified" ? (
          <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex items-start gap-2 sm:gap-3">
                <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-green-900 dark:text-green-100 text-sm sm:text-base">
                    {t('identity_already_verified')}
                  </p>
                  <p className="text-xs sm:text-sm text-green-700 dark:text-green-300 break-words">
                    {t('identity_verified_desc').replace('{status}', record.status)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {verificationMethods.map((method) => (
            <LevelGate
              key={method.id}
              requiredLevel={method.requiredLevel}
              fallback={
                <Card className="relative opacity-75">
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
                    <Badge variant="destructive" className="text-xs sm:text-sm">
                      {t('level_required').replace('{level}', String(method.requiredLevel))}
                    </Badge>
                  </div>
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="text-muted-foreground flex-shrink-0">{method.icon}</div>
                      {getStatusBadge(method.status)}
                    </div>
                    <CardTitle className="text-base sm:text-lg break-words">{method.title}</CardTitle>
                    <CardDescription className="text-xs sm:text-sm break-words">{method.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    <Button className="w-full text-sm sm:text-base" disabled>
                      {t('start_verification')}
                    </Button>
                  </CardContent>
                </Card>
              }
            >
              <Card className={`relative transition-all hover:shadow-lg ${
                method.status === "locked" ? "opacity-50" : ""
              }`}>
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className={`flex-shrink-0 ${
                      method.status === "completed" ? "text-green-600" :
                      method.status === "in-progress" ? "text-yellow-600" :
                      method.status === "locked" ? "text-muted-foreground" :
                      "text-primary"
                    }`}>
                      {method.icon}
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
                      {getStatusIcon(method.status)}
                      {getStatusBadge(method.status)}
                    </div>
                  </div>
                  <CardTitle className="text-base sm:text-lg break-words">{method.title}</CardTitle>
                  <CardDescription className="text-xs sm:text-sm break-words">{method.description}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  {method.status === "locked" ? (
                    <div className="space-y-2">
                      <p className="text-xs sm:text-sm text-muted-foreground break-words">
                        {t('unlock_method_first')}
                      </p>
                      <Button className="w-full text-sm sm:text-base" disabled>
                        {t('status_locked')}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full text-sm sm:text-base"
                      variant={method.status === "completed" ? "outline" : "default"}
                      onClick={method.action}
                    >
                      {method.status === "completed" ? t('view_details') : 
                       method.status === "in-progress" ? t('continue_verification') : 
                       t('start_verification')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </LevelGate>
          ))}
        </div>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">{t('verification_process')}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">{t('how_verification_works')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
            <div className="space-y-3">
              <div className="flex gap-2 sm:gap-3">
                <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                  1
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm sm:text-base">{t('step_community')}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground break-words">
                    {t('step_community_desc').replace('{count}', String(requiredWitnesses))}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2 sm:gap-3">
                <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                  2
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm sm:text-base">{t('step_authority')}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground break-words">
                    {t('step_authority_desc')}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2 sm:gap-3">
                <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                  3
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm sm:text-base">{t('step_documents')}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground break-words">
                    {t('step_documents_desc')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
