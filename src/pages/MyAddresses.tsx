import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, CheckCircle2, Clock, Award, Home, ArrowLeft, Eye, Star } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useAuthorizationLevel } from "@/hooks/useAuthorizationLevel";
import { VerificationStatusBar } from "@/components/VerificationStatusBar";
import { PrimaryResidenceBadge } from "@/components/PrimaryResidenceBadge";

type AfrolocRecord = Database["public"]["Tables"]["afroloc_records"]["Row"];

export default function MyAddresses() {
  const [records, setRecords] = useState<AfrolocRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { data: authLevel } = useAuthorizationLevel();

  // Fixed limit of 10 AFROLOC addresses per user
  const maxAddresses = 10;
  const canCreateMore = records.length < maxAddresses;
  const hasPrimaryResidence = records.some(r => r.is_primary_residence);
  const requiresPrimarySelection = records.length > 0 && !hasPrimaryResidence;

  useEffect(() => {
    checkAuthAndLoadRecords();
  }, []);

  const checkAuthAndLoadRecords = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/login");
      return;
    }

    loadRecords();
  };

  const loadRecords = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("afroloc_records")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error: any) {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Only house and apartment can be primary residence
  const ALLOWED_PRIMARY_RESIDENCE_TYPES = ['house', 'apartment'];

  const canBePrimaryResidence = (record: AfrolocRecord): boolean => {
    return ALLOWED_PRIMARY_RESIDENCE_TYPES.includes(record.property_type || '');
  };

  const handleSetPrimaryResidence = async (recordId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Find the record to validate property type
      const record = records.find(r => r.id === recordId);
      if (!record) return;

      // Validate property type - only house or apartment allowed
      if (!canBePrimaryResidence(record)) {
        toast({
          title: t("invalid_primary_residence_type") || "Tipo de propriedade inválido",
          description: t("primary_residence_must_be_residential") || "Apenas residências ou apartamentos podem ser definidos como residência principal. Terrenos e espaços comerciais não são permitidos.",
          variant: "destructive",
        });
        return;
      }

      // First, remove primary flag from all user's addresses
      const { error: clearError } = await supabase
        .from("afroloc_records")
        .update({ is_primary_residence: false })
        .eq("user_id", session.user.id);

      if (clearError) throw clearError;

      // Then, set the selected one as primary
      const { error } = await supabase
        .from("afroloc_records")
        .update({ is_primary_residence: true })
        .eq("id", recordId);

      if (error) throw error;

      toast({
        title: t("primary_residence_set") || "Residência principal definida",
        description: t("primary_residence_updated") || "A sua residência principal foi atualizada com sucesso.",
      });

      // Reload records to reflect the change
      await loadRecords();
    } catch (error: any) {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "certified":
        return <Award className="h-5 w-5" />;
      case "verified":
        return <CheckCircle2 className="h-5 w-5" />;
      default:
        return <Clock className="h-5 w-5" />;
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

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "draft":
        return t("status_draft");
      case "pending":
        return t("status_pending");
      case "verified":
        return t("status_verified");
      case "certified":
        return t("status_certified");
      default:
        return status;
    }
  };

  const formatAddress = (record: AfrolocRecord) => {
    const parts = [
      record.number,
      record.street_name,
      record.level4_name,
      record.level3_name,
      record.level2_name,
      record.level1_name,
      record.country,
    ].filter(Boolean);
    return parts.join(", ");
  };

  return (
    <DashboardLayout>
      <div className="w-full max-w-5xl mx-auto space-y-6 px-4">
        {/* Header */}
        <div className="relative rounded-xl bg-gradient-to-br from-primary/5 via-background to-accent/5 p-6 border border-border/50 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="flex-shrink-0 hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 space-y-2">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {t("my_addresses")}
              </h1>
              <p className="text-muted-foreground">
                {t("manage_your_afroloc_addresses")}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary">
                  {records.length} {records.length === 1 ? t("address") : t("addresses")}
                </Badge>
                <span className="text-muted-foreground text-sm">
                  / {maxAddresses} {t("available")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground text-lg">{t("loading")}</p>
          </div>
        ) : records.length === 0 ? (
          <Card className="border-2 border-dashed border-primary/20 bg-gradient-to-br from-background to-primary/5">
            <CardContent className="flex flex-col items-center justify-center py-16 px-4">
              <div className="rounded-full bg-gradient-to-br from-primary/20 to-primary/10 p-8 mb-6 shadow-lg">
                <MapPin className="h-16 w-16 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">
                {t("no_addresses_yet")}
              </h3>
              <p className="text-muted-foreground text-center max-w-md mb-8">
                {t("add_first_address_description")}
              </p>
              <Button 
                onClick={() => navigate("/create-identity")} 
                size="lg" 
                className="shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Plus className="mr-2 h-5 w-5" />
                {t("add_address")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Add New Address Button */}
            <Button
              onClick={() => navigate("/create-identity")}
              disabled={!canCreateMore}
              size="lg"
              className="w-full shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Plus className="mr-2 h-5 w-5" />
              {canCreateMore ? t("add_new_address") : t("maximum_reached")}
            </Button>

            {/* Addresses List */}
            <div className="space-y-4">
              {records.map((record, index) => (
                <Card
                  key={record.id}
                  className="border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg cursor-pointer"
                  onClick={() => navigate(`/identity/${record.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`rounded-full p-2 flex-shrink-0 ${(record as any).is_primary_residence ? 'bg-amber-500/20' : 'bg-primary/10'}`}>
                          {(record as any).is_primary_residence ? (
                            <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                          ) : (
                            <Home className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg mb-1 truncate">
                            {record.code}
                          </CardTitle>
                          <CardDescription className="text-sm line-clamp-2">
                            {formatAddress(record)}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end flex-shrink-0">
                        <Badge variant={getStatusVariant(record.status)} className="flex items-center gap-1">
                          {getStatusIcon(record.status)}
                          <span>{getStatusLabel(record.status)}</span>
                        </Badge>
                        <PrimaryResidenceBadge 
                          isPrimary={record.is_primary_residence === true}
                          size="sm"
                          interactive={record.is_primary_residence !== true && canBePrimaryResidence(record)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetPrimaryResidence(record.id);
                          }}
                        />
                      </div>
                    </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      {/* Verification Cycle Status Bar - Semáforo (apenas para endereços validados) */}
                      <VerificationStatusBar
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
                        createdAt={record.created_at}
                        showLabel={true}
                      />
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          {(record as any).is_primary_residence && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              {t("primary_residence_info")}
                            </span>
                          )}
                        </div>
                        <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/identity/${record.id}`);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        {t("view_details")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
