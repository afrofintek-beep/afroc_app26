import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LevelGate } from "@/components/LevelGate";
import { useAuthorizationLevel } from "@/hooks/useAuthorizationLevel";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, CheckCircle2, Clock, Award, List, Map, BarChart3, Search, Filter, X, SlidersHorizontal, ArrowLeft, QrCode, Users, AlertCircle, CheckCircle } from "lucide-react";
import { QRCodeDialog } from "@/components/QRCodeDialog";
import type { Database } from "@/integrations/supabase/types";
import IdentitiesMapView from "@/components/IdentitiesMapView";
import IdentitiesTimelineView from "@/components/IdentitiesTimelineView";
import { ATSScoreBadge } from "@/components/ATSScoreBadge";
import { AddressTypeBadge } from "@/components/AddressTypeBadge";
import { VerificationStatusBar } from "@/components/VerificationStatusBar";
import { PrimaryResidenceBadge } from "@/components/PrimaryResidenceBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type AfrolocRecord = Database["public"]["Tables"]["afroloc_records"]["Row"];

type AfrolocWitness = Database["public"]["Tables"]["afroloc_witnesses"]["Row"];

export default function Identities() {
  const [records, setRecords] = useState<AfrolocRecord[]>([]);
  const [witnessesCount, setWitnessesCount] = useState<Record<string, { total: number; confirmed: number }>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addressTypeFilter, setAddressTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>("all");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: authLevel } = useAuthorizationLevel();
  const { t } = useLanguage();

  // Fixed limit of 10 AFROLOC addresses per user
  const maxAddresses = 10;
  const canCreateMore = records.length < maxAddresses;

  const hasPrimaryResidence = records.some((r) => r.is_primary_residence === true);
  const requiresPrimarySelection = records.length > 0 && !hasPrimaryResidence;

  // Only house and apartment can be primary residence
  const ALLOWED_PRIMARY_RESIDENCE_TYPES = ["house", "apartment"];
  const canBePrimaryResidence = (record: AfrolocRecord): boolean => {
    return ALLOWED_PRIMARY_RESIDENCE_TYPES.includes(record.property_type || "");
  };

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
      if (!session) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("afroloc_records")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRecords(data || []);

      // Load witnesses count for each record
      if (data && data.length > 0) {
        const { data: witnessesData, error: witnessesError } = await supabase
          .from("afroloc_witnesses")
          .select("afroloc_record_id, status")
          .in("afroloc_record_id", data.map((r) => r.id));

        if (!witnessesError && witnessesData) {
          const counts: Record<string, { total: number; confirmed: number }> = {};
          witnessesData.forEach((w) => {
            if (!counts[w.afroloc_record_id]) {
              counts[w.afroloc_record_id] = { total: 0, confirmed: 0 };
            }
            counts[w.afroloc_record_id].total++;
            if (w.status === "confirmed") {
              counts[w.afroloc_record_id].confirmed++;
            }
          });
          setWitnessesCount(counts);
        }
      } else {
        setWitnessesCount({});
      }
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

  const handleSetPrimaryResidence = async (recordId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const record = records.find((r) => r.id === recordId);
      if (!record) return;

      if (!canBePrimaryResidence(record)) {
        toast({
          title: t("invalid_primary_residence_type") || "Tipo de propriedade inválido",
          description:
            t("primary_residence_must_be_residential") ||
            "Apenas residências ou apartamentos podem ser definidos como residência principal.",
          variant: "destructive",
        });
        return;
      }

      // The backend trigger ensures only one primary residence per user.
      const { error } = await supabase
        .from("afroloc_records")
        .update({ is_primary_residence: true })
        .eq("id", recordId);

      if (error) throw error;

      toast({
        title: t("primary_residence_set") || "Residência principal definida",
        description:
          t("primary_residence_updated") ||
          "A sua residência principal foi atualizada com sucesso.",
      });

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

  // Filter and sort records
  const filteredRecords = records
    .filter((record) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesCode = record.code.toLowerCase().includes(query);
        const matchesAddress = [
          record.street_name,
          record.number,
          record.level1_name,
          record.level2_name,
          record.level3_name,
          record.level4_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
        
        if (!matchesCode && !matchesAddress) return false;
      }

      // Status filter
      if (statusFilter !== "all" && record.status !== statusFilter) {
        return false;
      }

      // Property type filter
      if (propertyTypeFilter !== "all" && record.property_type !== propertyTypeFilter) {
        return false;
      }

      // Address type filter
      if (addressTypeFilter !== "all") {
        const recordAddressType = (record as any).address_type || 'digital';
        if (recordAddressType !== addressTypeFilter) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        case "alphabetical":
          return a.code.localeCompare(b.code);
        case "newest":
        default:
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
    });

  // Get unique property types for filter
  const propertyTypes = Array.from(new Set(records.map((r) => r.property_type).filter(Boolean)));

  const hasActiveFilters = searchQuery || statusFilter !== "all" || addressTypeFilter !== "all" || propertyTypeFilter !== "all" || sortBy !== "newest";

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setAddressTypeFilter("all");
    setPropertyTypeFilter("all");
    setSortBy("newest");
  };

  return (
    <DashboardLayout>
      <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6 md:space-y-8 px-0">
        {/* Header Section with Background */}
        <div className="relative rounded-xl bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 sm:p-8 border border-border/50 backdrop-blur-sm animate-fade-in">
          <div className="absolute inset-0 bg-grid-pattern opacity-5 rounded-xl"></div>
          <div className="relative flex flex-col gap-4 sm:gap-6">
            <div className="flex items-start gap-3 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/dashboard")}
                className="flex-shrink-0 hover:bg-primary/10 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="space-y-1 sm:space-y-2 flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {t("my_afrolocs")}
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base md:text-lg">
                  {t("manage_digital_addresses")}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge 
                    variant={records.length >= maxAddresses ? "destructive" : "secondary"} 
                    className="text-xs sm:text-sm font-medium"
                  >
                    {records.length} {t("of")} {maxAddresses} {t("addresses")}
                  </Badge>
                  {records.length >= maxAddresses && (
                    <span className="text-destructive text-xs sm:text-sm font-medium">
                      ({t("limit_reached")})
                    </span>
                  )}
                </div>
              </div>
            </div>
            <LevelGate 
              requiredLevel={2} 
              message={t("complete_profile_to_create")}
              fallback={
                <Button
                  variant="outline"
                  size="lg"
                  className="shadow-md w-full sm:w-auto"
                  onClick={() => {
                    toast({
                      title: t("create_new_afroloc"),
                      description: t("complete_profile_to_create"),
                      variant: "destructive",
                    });
                    navigate("/profile");
                  }}
                >
                  <Plus className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-sm sm:text-base">{t("create_new_afroloc")}</span>
                </Button>
              }
            >
              <Button 
                onClick={() => navigate("/identities/create")}
                disabled={!canCreateMore}
                size="lg"
                className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 w-full sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-sm sm:text-base">{canCreateMore ? t("create_new_afroloc") : t("maximum_reached")}</span>
              </Button>
            </LevelGate>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground text-lg">{t("loading_identities")}</p>
          </div>
        ) : records.length === 0 ? (
          <Card className="border-2 border-dashed border-primary/20 bg-gradient-to-br from-background to-primary/5 animate-fade-in">
            <CardContent className="flex flex-col items-center justify-center py-20 px-4">
              <div className="rounded-full bg-gradient-to-br from-primary/20 to-primary/10 p-8 mb-8 animate-scale-in shadow-lg" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
                <MapPin className="h-16 w-16 text-primary" />
              </div>
              <h3 className="text-3xl font-bold mb-3 animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
                {t("no_afrolocs_yet")}
              </h3>
              <p className="text-muted-foreground text-lg mb-10 text-center max-w-md animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
                {t("create_first_afroloc")}
              </p>
              <Button 
                onClick={() => navigate("/identities/create")} 
                size="lg"
                className="animate-scale-in shadow-lg hover:shadow-xl transition-all duration-300" 
                style={{ animationDelay: '0.4s', animationFillMode: 'both' }}
              >
                <Plus className="mr-2 h-5 w-5" />
                {t("create_your_first")}
              </Button>
            </CardContent>
          </Card>
            ) : (
        <> 
          {requiresPrimarySelection && (
            <Card className="border border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {t("primary_residence_required_profile") ||
                      "É obrigatório definir uma residência principal."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("primary_residence_must_be_residential") ||
                      "Escolha uma residência ou apartamento (terrenos/espaços comerciais não são permitidos)."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Search and Filters Card */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  <Input
                    placeholder={t("search_afrolocs")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 sm:pl-11 h-10 sm:h-11 bg-background/50 border-border/50 focus:bg-background transition-colors text-sm sm:text-base"
                  />
                </div>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2 h-10 sm:h-11 border-border/50 hover:bg-accent/50 text-sm sm:text-base">
                      <SlidersHorizontal className="h-4 w-4" />
                      <span className="hidden xs:inline">{t("filters")}</span>
                      {hasActiveFilters && (
                        <Badge variant="secondary" className="ml-1 px-1.5 sm:px-2 py-0.5 text-xs">
                          {[searchQuery, statusFilter !== "all", addressTypeFilter !== "all", propertyTypeFilter !== "all", sortBy !== "newest"].filter(Boolean).length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 bg-background border-border shadow-xl z-50" align="end">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">{t("filter_by_status")}</h4>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-background z-50">
                                <SelectItem value="all">{t("all_statuses")}</SelectItem>
                                <SelectItem value="draft">{t("status_draft")}</SelectItem>
                                <SelectItem value="pending">{t("status_pending")}</SelectItem>
                                <SelectItem value="verified">{t("status_verified")}</SelectItem>
                                <SelectItem value="certified">{t("status_certified")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">{t("address_type")}</h4>
                            <Select value={addressTypeFilter} onValueChange={setAddressTypeFilter}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-background z-50">
                                <SelectItem value="all">{t("all_types")}</SelectItem>
                                <SelectItem value="formal">{t("formal_address")}</SelectItem>
                                <SelectItem value="digital">{t("digital_address")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {propertyTypes.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">{t("filter_by_property")}</h4>
                              <Select value={propertyTypeFilter} onValueChange={setPropertyTypeFilter}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background z-50">
                                  <SelectItem value="all">{t("all_properties")}</SelectItem>
                                  {propertyTypes.map((type) => (
                                    <SelectItem key={type} value={type || ""} className="capitalize">
                                      {type}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">{t("sort_by")}</h4>
                            <Select value={sortBy} onValueChange={setSortBy}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-background z-50">
                                <SelectItem value="newest">{t("sort_newest")}</SelectItem>
                                <SelectItem value="oldest">{t("sort_oldest")}</SelectItem>
                                <SelectItem value="alphabetical">{t("sort_alphabetical")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {hasActiveFilters && (
                            <Button
                              variant="outline"
                              onClick={clearFilters}
                              className="w-full"
                            >
                              <X className="h-4 w-4 mr-2" />
                              {t("clear_filters")}
                            </Button>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

              {/* Results count */}
              {hasActiveFilters && (
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <span className="text-sm text-muted-foreground font-medium">
                    {t("showing_results").replace("{count}", filteredRecords.length.toString())}
                  </span>
                  {filteredRecords.length === 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="hover:bg-destructive/10 hover:text-destructive">
                      <X className="h-4 w-4 mr-1" />
                      {t("clear_filters")}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {filteredRecords.length === 0 && hasActiveFilters ? (
            <Card className="border-2 border-dashed border-muted-foreground/20 bg-gradient-to-br from-background to-muted/10 animate-fade-in">
              <CardContent className="flex flex-col items-center justify-center py-20 px-4">
                <div className="rounded-full bg-muted/50 p-8 mb-8 animate-scale-in shadow-inner" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
                  <Search className="h-16 w-16 text-muted-foreground" />
                </div>
                <h3 className="text-3xl font-bold mb-3 animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
                  {t("no_results_found")}
                </h3>
                <p className="text-muted-foreground text-lg mb-10 text-center max-w-md animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
                  {t("try_different_search")}
                </p>
                <Button 
                  onClick={clearFilters} 
                  variant="outline" 
                  size="lg"
                  className="animate-scale-in shadow-md hover:shadow-lg transition-all" 
                  style={{ animationDelay: '0.4s', animationFillMode: 'both' }}
                >
                  <X className="h-5 w-5 mr-2" />
                  {t("clear_filters")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="list" className="w-full space-y-4 sm:space-y-6">
              <div className="flex justify-center overflow-x-auto px-2">
                <TabsList className="grid w-full max-w-lg grid-cols-3 h-10 sm:h-12 bg-muted/50 border border-border/50">
                  <TabsTrigger value="list" className="data-[state=active]:bg-background data-[state=active]:shadow-md text-xs sm:text-sm">
                    <List className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden xs:inline">{t("list_view")}</span>
                    <span className="xs:hidden">{t("identities_list_short")}</span>
                  </TabsTrigger>
                  <TabsTrigger value="map" className="data-[state=active]:bg-background data-[state=active]:shadow-md text-xs sm:text-sm">
                    <Map className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden xs:inline">{t("map_view")}</span>
                    <span className="xs:hidden">{t("identities_map_short")}</span>
                  </TabsTrigger>
                  <TabsTrigger value="timeline" className="data-[state=active]:bg-background data-[state=active]:shadow-md text-xs sm:text-sm">
                    <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden xs:inline">{t("timeline_view")}</span>
                    <span className="xs:hidden">{t("identities_timeline_short")}</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="list" className="mt-0 animate-fade-in" style={{ animationDuration: '0.4s' }}>
                <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredRecords.map((record, index) => (
                    <Card 
                      key={record.id} 
                      className="group hover:shadow-xl transition-all duration-300 cursor-pointer animate-scale-in border-border/50 hover:border-primary/30 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm overflow-hidden" 
                      style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'both' }}
                      onClick={() => navigate(`/identity/${record.id}`)}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <CardHeader className="relative">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg font-mono break-all group-hover:text-primary transition-colors">
                              {record.code}
                            </CardTitle>
                            <CardDescription className="mt-2 text-sm">
                              {record.level4_name || record.level3_name || record.level2_name}
                            </CardDescription>
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            <ATSScoreBadge
                              atsScore={record.ats_score}
                              certificationLevel={record.certification_level}
                              breakdown={record.ats_breakdown}
                              size="sm"
                            />
                            <Badge 
                              variant={getStatusVariant(record.status)} 
                              className="flex items-center gap-1.5 flex-shrink-0 shadow-sm"
                            >
                              {getStatusIcon(record.status)}
                              {getStatusLabel(record.status)}
                            </Badge>
                            <AddressTypeBadge addressType={record.address_type} isCertified={record.status === "certified"} size="sm" />
                            <PrimaryResidenceBadge
                              isPrimary={record.is_primary_residence === true}
                              size="sm"
                              interactive={record.is_primary_residence !== true && canBePrimaryResidence(record)}
                              onClick={() => handleSetPrimaryResidence(record.id)}
                            />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="relative">
                              <div className="space-y-3 text-sm">
                                <div className="flex items-center text-muted-foreground">
                                  <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                                  <span className="truncate">
                                    {record.street_name && `${record.street_name}, `}
                                    {record.number}
                                  </span>
                                </div>
                                {record.property_type && (
                                  <div className="text-xs">
                                    <Badge variant="outline" className="capitalize">
                                      {record.property_type}
                                    </Badge>
                                  </div>
                                )}
                                {record.geo_lat && record.geo_lon && (
                                  <div className="text-xs text-muted-foreground font-mono">
                                    GPS: {Number(record.geo_lat).toFixed(5)}, {Number(record.geo_lon).toFixed(5)}
                                  </div>
                                )}

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
                                  className="mt-2"
                                />
                                
                                {/* Witnesses Progress */}
                                {record.status === "draft" && (
                                  <div className="pt-3 mt-3 border-t border-border/50">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                          <Users className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                          <p className="text-xs font-semibold text-foreground">{t("identities_witnesses")}</p>
                                          <p className="text-xs text-muted-foreground">{t("identities_confirmations_needed")}</p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-lg font-bold text-primary">
                                          {witnessesCount[record.id]?.confirmed || 0}<span className="text-muted-foreground">/3</span>
                                        </p>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full transition-all duration-500 ${
                                            (witnessesCount[record.id]?.confirmed || 0) >= 3 
                                              ? 'bg-green-500' 
                                              : 'bg-gradient-to-r from-primary to-primary/70'
                                          }`}
                                          style={{ width: `${((witnessesCount[record.id]?.confirmed || 0) / 3) * 100}%` }}
                                        />
                                      </div>
                                      
                                      {/* Witness indicators */}
                                      <div className="flex gap-1 justify-between">
                                        {[0, 1, 2].map((index) => {
                                          const confirmed = (witnessesCount[record.id]?.confirmed || 0) > index;
                                          return (
                                            <div 
                                              key={index}
                                              className={`flex-1 h-8 rounded-md flex items-center justify-center border-2 transition-all ${
                                                confirmed
                                                  ? 'bg-green-50 border-green-500 dark:bg-green-900/20'
                                                  : 'bg-muted border-border'
                                              }`}
                                            >
                                              {confirmed ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                              ) : (
                                                <Users className="h-3 w-3 text-muted-foreground" />
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      
                                      {(witnessesCount[record.id]?.confirmed || 0) < 3 && (
                                        <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                                          <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                                            Precisa de {3 - (witnessesCount[record.id]?.confirmed || 0)} testemunha{3 - (witnessesCount[record.id]?.confirmed || 0) > 1 ? 's' : ''}
                                          </p>
                                        </div>
                                      )}
                                      
                                      {(witnessesCount[record.id]?.confirmed || 0) >= 3 && (
                                        <div className="flex items-start gap-2 p-2 rounded-md bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30">
                                          <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                          <p className="text-xs text-green-700 dark:text-green-400 font-medium leading-relaxed">
                                            {t("identities_ready_for_verification")}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                                  <QRCodeDialog 
                                    record={record}
                                    trigger={
                                      <Button variant="outline" size="sm" className="w-full gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors">
                                        <QrCode className="h-4 w-4" />
                                        {t("identities_view_qr_code")}
                                      </Button>
                                    }
                                  />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="map" className="mt-6 animate-fade-in" style={{ animationDuration: '0.4s' }}>
                      <IdentitiesMapView records={filteredRecords} />
                    </TabsContent>

                    <TabsContent value="timeline" className="mt-6 animate-fade-in" style={{ animationDuration: '0.4s' }}>
                      <IdentitiesTimelineView records={filteredRecords} />
                    </TabsContent>
                  </Tabs>
                )}
              </>
            )}
          </div>
    </DashboardLayout>
  );
}
