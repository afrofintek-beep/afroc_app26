import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, Shield, CheckCircle, Search, Navigation } from "lucide-react";
import { toast } from "sonner";

interface FormalAddress {
  id: string;
  code: string;
  country: string;
  level1_name: string | null;
  level2_name: string | null;
  level3_name: string | null;
  level4_name: string | null;
  street_name: string | null;
  number: string | null;
  geo_lat: number | null;
  geo_lon: number | null;
  gps_validated_at: string | null;
  user_id: string;
}

export default function AuthorityGPSValidation() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<FormalAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<FormalAddress | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [gpsLat, setGpsLat] = useState("");
  const [gpsLon, setGpsLon] = useState("");
  const [validationNotes, setValidationNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [authLevel, setAuthLevel] = useState<number>(0);

  useEffect(() => {
    checkAuthAndLoadAddresses();
  }, []);

  const checkAuthAndLoadAddresses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('gpsval_unauthorized'));
        navigate("/login");
        return;
      }

      // Check authorization level
      const { data: authData, error: authError } = await supabase
        .from("user_authorization_levels")
        .select("current_level, jurisdiction_country")
        .eq("user_id", user.id)
        .single();

      if (authError || !authData || authData.current_level < 3) {
        toast.error(t('gpsval_insufficient_level'));
        navigate("/dashboard");
        return;
      }

      setAuthLevel(authData.current_level);

      // Load formal addresses in jurisdiction
      const { data: addressesData, error: addressesError } = await supabase
        .from("afroloc_records")
        .select("*")
        .eq("address_type", "formal")
        .eq("country", authData.jurisdiction_country)
        .order("created_at", { ascending: false });

      if (addressesError) throw addressesError;
      setAddresses(addressesData || []);
    } catch (error) {
      console.error("Error loading addresses:", error);
      toast.error(t('gpsval_load_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAddress) return;

    const lat = parseFloat(gpsLat);
    const lon = parseFloat(gpsLon);

    if (isNaN(lat) || isNaN(lon)) {
      toast.error(t('gpsval_invalid_coords'));
      return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      toast.error(t('gpsval_coords_out_of_range'));
      return;
    }

    if (!validationNotes.trim()) {
      toast.error(t('gpsval_notes_required'));
      return;
    }

    setSubmitting(true);

    try {
      // Update the address with GPS coordinates
      const { error: updateError } = await supabase
        .from("afroloc_records")
        .update({
          geo_lat: lat,
          geo_lon: lon,
          gps_validation_notes: validationNotes,
        })
        .eq("id", selectedAddress.id);

      if (updateError) throw updateError;

      // Create authority validation record
      const { error: validationError } = await supabase
        .from("afroloc_validations")
        .insert({
          afroloc_record_id: selectedAddress.id,
          validation_method: "gps_authority_validation",
          authority_role: `Nível ${authLevel}`,
          notes: validationNotes,
          verified_at: new Date().toISOString(),
        });

      if (validationError) throw validationError;

      toast.success(t('gpsval_validate_success'));
      setSelectedAddress(null);
      setGpsLat("");
      setGpsLon("");
      setValidationNotes("");
      checkAuthAndLoadAddresses();
    } catch (error) {
      console.error("Error validating GPS:", error);
      toast.error(t('gpsval_validate_error'));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAddresses = addresses.filter(addr => 
    addr.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    addr.street_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    addr.number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('gpsval_page_title')}</h1>
          </div>
          <p className="text-muted-foreground">
            {t('gpsval_page_subtitle')}
          </p>
          <Badge variant="default" className="mt-2">
            {t('gpsval_auth_level_badge')} {authLevel}
          </Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Address List */}
          <Card>
            <CardHeader>
              <CardTitle>{t('gpsval_formal_addresses')}</CardTitle>
              <CardDescription>
                {t('gpsval_select_to_add')}
              </CardDescription>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('gpsval_search_placeholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredAddresses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {t('gpsval_no_addresses')}
                  </p>
                ) : (
                  filteredAddresses.map((addr) => (
                    <Card
                      key={addr.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedAddress?.id === addr.id ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => setSelectedAddress(addr)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-mono font-semibold text-sm mb-1">
                              {addr.code}
                            </p>
                            <p className="text-sm">
                              {addr.street_name} {addr.number && `#${addr.number}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {addr.level4_name}, {addr.level3_name}
                            </p>
                          </div>
                          {addr.geo_lat && addr.geo_lon ? (
                            <Badge variant="default" className="ml-2 flex-shrink-0">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              GPS
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="ml-2 flex-shrink-0">
                              {t('gpsval_no_gps')}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* GPS Validation Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {t('gpsval_coords_validation')}
              </CardTitle>
              <CardDescription>
                {selectedAddress
                  ? `${t('gpsval_validating')} ${selectedAddress.code}`
                  : t('gpsval_select_to_start')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedAddress ? (
                <Alert>
                  <AlertDescription>
                    {t('gpsval_empty_state_hint')}
                  </AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{t('gpsval_official_validation_label')}</strong> {t('gpsval_official_validation_text')}
                    </AlertDescription>
                  </Alert>

                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <p className="text-sm font-semibold">{t('gpsval_selected_address')}</p>
                    <p className="text-sm">{selectedAddress.street_name} #{selectedAddress.number}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedAddress.level4_name}, {selectedAddress.level3_name}, {selectedAddress.level2_name}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        if (!navigator.geolocation) {
                          toast.error(t('gpsval_geolocation_unsupported'));
                          return;
                        }
                        
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            setGpsLat(position.coords.latitude.toString());
                            setGpsLon(position.coords.longitude.toString());
                            toast.success(t('gpsval_location_success'));
                          },
                          (error) => {
                            console.error("Error getting location:", error);
                            toast.error(t('gpsval_location_error'));
                          }
                        );
                      } catch (error) {
                        console.error("Error getting location:", error);
                        toast.error(t('gpsval_location_error'));
                      }
                    }}
                    className="w-full"
                  >
                    <Navigation className="mr-2 h-4 w-4" />
                    {t('gpsval_get_current_location')}
                  </Button>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gpsLat">
                        {t('gpsval_latitude')} *
                      </Label>
                      <Input
                        id="gpsLat"
                        type="number"
                        step="0.000001"
                        value={gpsLat}
                        onChange={(e) => setGpsLat(e.target.value)}
                        placeholder="-8.8383"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gpsLon">
                        {t('gpsval_longitude')} *
                      </Label>
                      <Input
                        id="gpsLon"
                        type="number"
                        step="0.000001"
                        value={gpsLon}
                        onChange={(e) => setGpsLon(e.target.value)}
                        placeholder="13.2344"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="validationNotes">
                      {t('gpsval_validation_notes')} *
                      <span className="text-muted-foreground text-sm ml-2">
                        {t('gpsval_validation_notes_hint')}
                      </span>
                    </Label>
                    <Textarea
                      id="validationNotes"
                      value={validationNotes}
                      onChange={(e) => setValidationNotes(e.target.value)}
                      placeholder={t('gpsval_notes_placeholder')}
                      rows={4}
                      required
                    />
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 p-4 rounded-lg">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      <strong>{t('gpsval_liability_label')}</strong> {t('gpsval_liability_text')}
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedAddress(null);
                        setGpsLat("");
                        setGpsLon("");
                        setValidationNotes("");
                      }}
                      disabled={submitting}
                      className="flex-1"
                    >
                      {t('gpsval_cancel')}
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="flex-1"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {submitting ? t('gpsval_validating_btn') : t('gpsval_validate_officially')}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
