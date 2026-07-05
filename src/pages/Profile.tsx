import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, User, Fingerprint, Shield, Trash2, Clock, Monitor, Languages, Smartphone, Tablet, MonitorSmartphone, Star } from "lucide-react";
import { useCountries } from "@/hooks/useCountries";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { useLanguage, Language } from "@/contexts/LanguageContext";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { VerificationCycleIndicator } from "@/components/VerificationCycleIndicator";
import { VerificationStatusBar } from "@/components/VerificationStatusBar";
import { usePrimaryResidence } from "@/hooks/usePrimaryResidence";
import { PrimaryResidenceBadge } from "@/components/PrimaryResidenceBadge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { countries } = useCountries();
  const { language, setLanguage, t } = useLanguage();
  const { primaryResidence, hasPrimaryResidence, totalAddresses, requiresPrimarySelection, formatAddress } = usePrimaryResidence();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [removingBiometric, setRemovingBiometric] = useState(false);
  const [biometricHistory, setBiometricHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [trustedDevices, setTrustedDevices] = useState<any[]>([]);
  const [loadingTrustedDevices, setLoadingTrustedDevices] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const { 
    capabilities: biometricCapabilities, 
    deleteCredentials,
    getBiometricLabel 
  } = useBiometricAuth();
  const [profile, setProfile] = useState({
    full_name: "",
    phone: "",
    country: "",
    city: "",
    afro_id: "",
  });
  const [verificationData, setVerificationData] = useState<{
    street_name?: string | null;
    number?: string | null;
    street_code?: string | null;
    address_type?: string | null;
    property_type?: string | null;
    status?: string | null;
    last_verified_at?: string | null;
    next_verification_due?: string | null;
    geo_lat?: number | null;
    geo_lon?: number | null;
    gps_validated_at?: string | null;
    photo_exif_gps_lat?: number | null;
    photo_exif_gps_lon?: number | null;
    created_at?: string | null;
  } | null>(null);

  useEffect(() => {
    loadProfile();
    loadBiometricHistory();
    loadTrustedDevices();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, country, city, afro_id")
        .eq("user_id", session.user.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile({
          full_name: data.full_name || "",
          phone: data.phone || "",
          country: data.country || "",
          city: data.city || "",
          afro_id: data.afro_id || "",
        });
        
        // Load verification cycle data from afroloc_records
        if (data.afro_id) {
          const { data: recordData } = await supabase
            .from("afroloc_records")
            .select("street_name, number, street_code, address_type, property_type, status, last_verified_at, next_verification_due, geo_lat, geo_lon, gps_validated_at, photo_exif_gps_lat, photo_exif_gps_lon, created_at")
            .eq("code", data.afro_id)
            .maybeSingle();
          
          if (recordData) {
            setVerificationData(recordData);
          }
        }
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast({
        variant: "destructive",
        title: t("error"),
        description: "Não foi possível carregar o perfil.",
      });
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          country: profile.country,
          city: profile.city,
        })
        .eq("user_id", session.user.id);

      if (error) throw error;

      toast({
        title: t("success"),
        description: t("profile_updated"),
      });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        variant: "destructive",
        title: t("error"),
        description: error.message || t("profile_update_error"),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadBiometricHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      const { data, error } = await supabase
        .from('biometric_login_history')
        .select('*')
        .eq('user_id', session.user.id)
        .order('login_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setBiometricHistory(data || []);
    } catch (error: any) {
      console.error('Error loading biometric history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadTrustedDevices = async () => {
    setLoadingTrustedDevices(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      const { data, error } = await supabase
        .from('biometric_devices')
        .select('*')
        .eq('user_id', session.user.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTrustedDevices(data || []);
    } catch (error: any) {
      console.error('Error loading trusted devices:', error);
    } finally {
      setLoadingTrustedDevices(false);
    }
  };

  const handleRevokeTrustedDevice = async (deviceId: string) => {
    setRevokingDeviceId(deviceId);
    try {
      const { error } = await supabase
        .from('biometric_devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;

      toast({
        title: t("success"),
        description: t("trusted_device_revoked") || "Dispositivo revogado com sucesso",
      });

      await loadTrustedDevices();
    } catch (error: any) {
      console.error('Error revoking trusted device:', error);
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("trusted_device_revoke_error") || "Erro ao revogar dispositivo",
      });
    } finally {
      setRevokingDeviceId(null);
    }
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
      case 'smartphone':
        return Smartphone;
      case 'tablet':
        return Tablet;
      default:
        return MonitorSmartphone;
    }
  };

  const handleRemoveBiometric = async () => {
    setRemovingBiometric(true);
    try {
      const success = await deleteCredentials();
      
      if (success) {
        toast({
          title: t("success"),
          description: t("biometric_removed"),
        });
      } else {
        throw new Error("Falha ao remover credenciais");
      }
    } catch (error: any) {
      console.error("Error removing biometric:", error);
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("biometric_remove_error"),
      });
    } finally {
      setRemovingBiometric(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container max-w-2xl py-8 px-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">{t("profile_title")}</CardTitle>
                <CardDescription>
                  {t("profile_description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Primary Residence Section - Key Profile Element */}
              <div className="space-y-3">
                <div className={`p-4 rounded-lg border-2 ${
                  requiresPrimarySelection 
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500' 
                    : hasPrimaryResidence 
                    ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-500/50' 
                    : 'bg-muted border-border'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Star className={`h-4 w-4 ${hasPrimaryResidence ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`} />
                      {t("primary_residence") || "Residência Principal"}
                    </Label>
                    {totalAddresses > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {totalAddresses}/10 {t("addresses") || "endereços"}
                      </Badge>
                    )}
                  </div>
                  
                  {requiresPrimarySelection ? (
                    <div className="space-y-2">
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        {t("primary_residence_required_profile") || "É obrigatório definir uma residência principal para homologação junto às autoridades."}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/identities")}
                        className="border-amber-500 text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900"
                      >
                        {t("select_primary_residence") || "Selecionar Residência Principal"}
                      </Button>
                    </div>
                  ) : hasPrimaryResidence && primaryResidence ? (
                    <div className="space-y-2">
                      <p className="text-lg font-semibold">{primaryResidence.code}</p>
                      <p className="text-sm text-muted-foreground">{formatAddress(primaryResidence)}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/identity/${primaryResidence.id}`)}
                        className="text-xs p-0 h-auto text-primary hover:underline"
                      >
                        {t("view_details") || "Ver detalhes"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("no_addresses_yet") || "Ainda não tem endereços registados."}
                    </p>
                  )}
                </div>
              </div>

              {profile.afro_id && (
                <div className="space-y-3">
                  <div className="p-4 bg-muted rounded-lg">
                    <Label className="text-sm text-muted-foreground">{t("afroloc_label")}</Label>
                    <p className="text-lg font-semibold mt-1">{profile.afro_id}</p>
                  </div>
                  
                  {/* Verification Status Bar */}
                  {verificationData && (
                    <div className="p-4 bg-card rounded-lg border border-border">
                      <Label className="text-sm font-medium mb-3 block">Status de Verificação</Label>
                      <VerificationStatusBar
                        streetName={verificationData.street_name}
                        number={verificationData.number}
                        streetCode={verificationData.street_code}
                        addressType={verificationData.address_type}
                        propertyType={verificationData.property_type}
                        status={verificationData.status}
                        lastVerifiedAt={verificationData.last_verified_at}
                        nextVerificationDue={verificationData.next_verification_due}
                        geoLat={verificationData.geo_lat}
                        geoLon={verificationData.geo_lon}
                        gpsValidatedAt={verificationData.gps_validated_at}
                        photoExifGpsLat={verificationData.photo_exif_gps_lat}
                        photoExifGpsLon={verificationData.photo_exif_gps_lon}
                        createdAt={verificationData.created_at}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="full_name">{t("full_name_label")}</Label>
                <Input
                  id="full_name"
                  type="text"
                  value={profile.full_name}
                  onChange={(e) =>
                    setProfile({ ...profile, full_name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="phone">{t("phone_label")}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/profile/change-phone")}
                    className="text-xs text-primary hover:text-primary"
                  >
                    {t("change")}
                  </Button>
                </div>
                <Input
                  id="phone"
                  type="tel"
                  value={profile.phone}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  {t("phone_is_primary_identifier")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">{t("country_label")}</Label>
                <Select
                  value={profile.country}
                  onValueChange={(value) =>
                    setProfile({ ...profile, country: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("select_country_label")} />
                  </SelectTrigger>
                  <SelectContent>
                    {countries?.map((country) => (
                      <SelectItem
                        key={country.country_code}
                        value={country.country_code}
                      >
                        {t(`country_${country.country_code}`) !== `country_${country.country_code}` 
                          ? t(`country_${country.country_code}`)
                          : country.country_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">{t("city_label")}</Label>
                <Input
                  id="city"
                  type="text"
                  value={profile.city}
                  onChange={(e) =>
                    setProfile({ ...profile, city: e.target.value })
                  }
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("saving")}
                  </>
                ) : (
                  t("save_changes")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Verification Cycle Card */}
        {verificationData && (
          <VerificationCycleIndicator
            streetName={verificationData.street_name}
            number={verificationData.number}
            streetCode={verificationData.street_code}
            addressType={verificationData.address_type}
            propertyType={verificationData.property_type}
            status={verificationData.status}
            lastVerifiedAt={verificationData.last_verified_at}
            nextVerificationDue={verificationData.next_verification_due}
            geoLat={verificationData.geo_lat}
            geoLon={verificationData.geo_lon}
            gpsValidatedAt={verificationData.gps_validated_at}
            photoExifGpsLat={verificationData.photo_exif_gps_lat}
            photoExifGpsLon={verificationData.photo_exif_gps_lon}
            createdAt={verificationData.created_at}
          />
        )}

        {/* Security Settings Card */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{t("security_title")}</CardTitle>
                <CardDescription>
                  {t("security_description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Biometric Authentication Section */}
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="h-5 w-5 text-muted-foreground" />
                    <Label className="text-base font-semibold">
                      {t("biometric_auth")}
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {biometricCapabilities.isAvailable
                      ? biometricCapabilities.hasCredentials
                        ? t("biometric_active").replace("{type}", getBiometricLabel())
                        : t("biometric_available").replace("{type}", getBiometricLabel())
                      : t("biometric_unavailable")}
                  </p>
                </div>
                
                {biometricCapabilities.isAvailable && !biometricCapabilities.hasCredentials && (
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      navigate('/login?setup-biometric=true');
                    }}
                  >
                    <Fingerprint className="h-4 w-4 mr-2" />
                    {t("activate")}
                  </Button>
                )}
                
                {biometricCapabilities.isAvailable && biometricCapabilities.hasCredentials && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={removingBiometric}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t("remove")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("remove_biometric_title")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("remove_biometric_description")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleRemoveBiometric}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t("remove")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              {biometricCapabilities.isAvailable && !biometricCapabilities.hasCredentials && (
                <div className="p-4 bg-muted rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground">
                    {t("biometric_setup_instructions")}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Device Info */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">{t("device_info")}</Label>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>{t("biometry_type")}: {getBiometricLabel()}</p>
                <p>{t("status")}: {biometricCapabilities.isAvailable ? t("available") : t("not_available")}</p>
              </div>
            </div>

            {/* Biometric Login History */}
            {biometricCapabilities.hasCredentials && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">{t("login_history")}</Label>
                    {loadingHistory && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  
                  {biometricHistory.length === 0 ? (
                    <div className="p-4 bg-muted rounded-lg border border-border text-center">
                      <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {t("no_logins_yet")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {biometricHistory.map((login) => (
                        <div
                          key={login.id}
                          className="p-3 bg-muted rounded-lg border border-border space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-2">
                              <Monitor className="h-4 w-4 mt-1 text-muted-foreground" />
                              <div className="space-y-1">
                                <p className="text-sm font-medium">{login.device_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {login.biometry_type} • {login.browser || 'Navegador desconhecido'} • {login.os || 'SO desconhecido'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>
                                {formatDistanceToNow(new Date(login.login_at), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })}
                              </span>
                            </div>
                          </div>
                          {login.ip_address && (
                            <p className="text-xs text-muted-foreground">
                              IP: {login.ip_address}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Trusted Devices Card */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MonitorSmartphone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{t("trusted_devices_title") || "Dispositivos Confiáveis"}</CardTitle>
                <CardDescription>
                  {t("trusted_devices_description") || "Faça a gestão dos dispositivos autorizados para início de sessão rápido"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingTrustedDevices ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : trustedDevices.length === 0 ? (
              <div className="p-4 bg-muted rounded-lg border border-border text-center">
                <MonitorSmartphone className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t("no_trusted_devices") || "Nenhum dispositivo confiável registado"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("trusted_devices_hint") || "Marque 'Lembrar-me' ao fazer login para adicionar dispositivos"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {trustedDevices.map((device) => {
                  const DeviceIcon = getDeviceIcon(device.device_type);
                  return (
                    <div
                      key={device.id}
                      className="p-4 bg-muted rounded-lg border border-border"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <DeviceIcon className="h-5 w-5 mt-0.5 text-primary" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {device.device_name || t("unknown_device") || "Dispositivo desconhecido"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {device.browser || ''} {device.os ? `• ${device.os}` : ''}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>
                                {t("last_used") || "Último uso"}: {device.last_used_at ? formatDistanceToNow(new Date(device.last_used_at), {
                                  addSuffix: true,
                                  locale: ptBR,
                                }) : t("never") || "Nunca"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {t("expires") || "Expira"}: {formatDistanceToNow(new Date(device.expires_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={revokingDeviceId === device.id}
                            >
                              {revokingDeviceId === device.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("revoke_trusted_device_title") || "Revogar dispositivo?"}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("revoke_trusted_device_description") || "Este dispositivo não poderá mais usar o login rápido. Você precisará usar o código OTP na próxima vez."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleRevokeTrustedDevice(device.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {t("revoke") || "Revogar"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Language Settings Card */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Languages className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{t("language_settings_title")}</CardTitle>
                <CardDescription>
                  {t("language_settings_description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="language">{t("language_label")}</Label>
              <Select
                value={language}
                onValueChange={(value: Language) => {
                  setLanguage(value);
                  toast({
                    title: t("language_changed"),
                    description: t("language_changed_description"),
                  });
                }}
              >
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="pt">🇵🇹 Português</SelectItem>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                  <SelectItem value="fr">🇫🇷 Français</SelectItem>
                  <SelectItem value="ar">🇸🇦 العربية</SelectItem>
                  <SelectItem value="am">🇪🇹 አማርኛ</SelectItem>
                  <SelectItem value="sw">🇰🇪 Kiswahili</SelectItem>
                  <SelectItem value="ln">🇨🇩 Lingála</SelectItem>
                  <SelectItem value="yo">🇳🇬 Yorùbá</SelectItem>
                  <SelectItem value="sn">🇿🇼 chiShona</SelectItem>
                  <SelectItem value="zu">🇿🇦 isiZulu</SelectItem>
                  <SelectItem value="kmb">🇦🇴 Kimbundu</SelectItem>
                  <SelectItem value="umb">🇦🇴 Umbundu</SelectItem>
                  <SelectItem value="kg">🇦🇴 Kikongo</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {t("language_independent_note")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
