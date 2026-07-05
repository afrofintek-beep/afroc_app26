import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Wifi, WifiOff, Save, ArrowLeft, Users, Shield, AlertTriangle } from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { 
  saveOfflineAfroloc, 
  getOfflineCount, 
  resolveZoneOffline,
  getOperatorConfig,
  saveOperatorConfig,
  incrementOperatorCount,
  OperatorConfig
} from "@/utils/offlineStorage";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { OfflineWitnessCapture } from "@/components/OfflineWitnessCapture";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/contexts/LanguageContext";

export default function OfflineCreateIdentity() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { coordinates, loading: gpsLoading, getCurrentPosition } = useGeolocation();
  const { isOnline, networkType } = useNetworkStatus();
  
  const [offlineCount, setOfflineCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [witnesses, setWitnesses] = useState<any[]>([]);
  
  // Operator mode
  const [operatorMode, setOperatorMode] = useState(false);
  const [operatorConfig, setOperatorConfigState] = useState<OperatorConfig | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState<number>(0);
  
  // Zone detection
  const [detectedZone, setDetectedZone] = useState<'urban' | 'rural'>('rural');
  const [gridSize, setGridSize] = useState<10 | 25>(25);

  // Form fields
  const [country, setCountry] = useState("AO"); // Default to Angola
  const [level1Name, setLevel1Name] = useState("");
  const [level2Name, setLevel2Name] = useState("");
  const [level3Name, setLevel3Name] = useState("");
  const [level4Name, setLevel4Name] = useState("");
  const [addressType, setAddressType] = useState<'formal' | 'informal'>('informal');
  const [streetName, setStreetName] = useState("");
  const [number, setNumber] = useState("");
  const [unit, setUnit] = useState("");
  const [propertyType, setPropertyType] = useState("");

  useEffect(() => {
    loadUserAndCount();
  }, []);

  // Update zone detection when location changes
  useEffect(() => {
    const adminPath = [level1Name, level2Name, level3Name, level4Name].filter(Boolean).join('/');
    const { zone, gridSize: size } = resolveZoneOffline(adminPath);
    setDetectedZone(zone);
    setGridSize(size);
  }, [level1Name, level2Name, level3Name, level4Name]);

  const loadUserAndCount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const count = await getOfflineCount();
      setOfflineCount(count);
      
      // Check for operator config
      const config = await getOperatorConfig(user.id);
      if (config) {
        setOperatorMode(true);
        setOperatorConfigState(config);
        setQuotaRemaining(config.daily_quota - config.records_today);
      }
    } else {
      navigate("/login");
    }
  };

  const enableOperatorMode = async () => {
    if (!userId) return;
    
    // Create default operator config
    const config: OperatorConfig = {
      operator_id: userId,
      operator_name: 'Field Operator',
      daily_quota: 50, // Default 50 records per day
      records_today: 0,
      last_reset_date: new Date().toISOString().split('T')[0],
      jurisdiction_country: country,
      jurisdiction_level1: level1Name || undefined,
      jurisdiction_level2: level2Name || undefined
    };
    
    await saveOperatorConfig(config);
    setOperatorMode(true);
    setOperatorConfigState(config);
    setQuotaRemaining(config.daily_quota);
    
    toast({
      title: t('offlineid_operator_activated_title'),
      description: `${t('offlineid_daily_quota')}: ${config.daily_quota} ${t('offlineid_records')}`,
    });
  };

  const handleSave = async () => {
    if (!userId) {
      toast({
        title: t('offlineid_error'),
        description: t('offlineid_auth_required'),
        variant: "destructive",
      });
      return;
    }

    if (!country || !level1Name) {
      toast({
        title: t('offlineid_required_fields'),
        description: t('offlineid_country_region_required'),
        variant: "destructive",
      });
      return;
    }

    // Check operator quota
    if (operatorMode) {
      const { allowed, remaining } = await incrementOperatorCount(userId);
      if (!allowed) {
        toast({
          title: t('offlineid_quota_exhausted_title'),
          description: t('offlineid_quota_exhausted_desc'),
          variant: "destructive",
        });
        return;
      }
      setQuotaRemaining(remaining);
    }

    setSaving(true);
    try {
      const { id, code } = await saveOfflineAfroloc({
        code: '', // Will be generated
        country,
        level1_name: level1Name,
        level2_name: level2Name || undefined,
        level3_name: level3Name || undefined,
        level4_name: level4Name || undefined,
        street_name: streetName || undefined,
        number: number || undefined,
        unit: unit || undefined,
        address_type: addressType,
        property_type: propertyType || undefined,
        geo_lat: coordinates?.latitude,
        geo_lon: coordinates?.longitude,
        witnesses: witnesses,
        user_id: userId,
        operator_id: operatorMode ? userId : undefined,
      });

      const count = await getOfflineCount();
      setOfflineCount(count);

      toast({
        title: t('offlineid_saved_offline_title'),
        description: (
          <div className="space-y-1">
            <p className="font-mono text-sm font-bold">{code}</p>
            <p className="text-xs text-muted-foreground">
              {count} {count !== 1 ? t('offlineid_records_pending_sync_plural') : t('offlineid_records_pending_sync_singular')}
            </p>
          </div>
        ),
      });

      // Reset form
      setLevel1Name("");
      setLevel2Name("");
      setLevel3Name("");
      setLevel4Name("");
      setStreetName("");
      setNumber("");
      setUnit("");
      setPropertyType("");
      setWitnesses([]);
      
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: t('offlineid_save_error_title'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/identities")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge variant="outline" className="gap-1">
                <Wifi className="h-3 w-3" />
                {t('offlineid_online')} ({networkType})
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="h-3 w-3" />
                {t('offlineid_offline')}
              </Badge>
            )}

            {offlineCount > 0 && (
              <Badge variant="secondary">
                {offlineCount} {offlineCount !== 1 ? t('offlineid_pending_plural') : t('offlineid_pending_singular')}
              </Badge>
            )}
          </div>
        </div>

        {/* Operator Mode Card */}
        {operatorMode && operatorConfig && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">{t('offlineid_field_operator_mode')}</span>
                </div>
                <Badge variant="outline">
                  {quotaRemaining}/{operatorConfig.daily_quota}
                </Badge>
              </div>
              <Progress 
                value={(operatorConfig.records_today / operatorConfig.daily_quota) * 100} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {operatorConfig.records_today} {t('offlineid_of')} {operatorConfig.daily_quota} {t('offlineid_records_today')}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t('offlineid_card_title')}</CardTitle>
            <CardDescription>
              {t('offlineid_card_description')}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Zone Detection Alert */}
            <Alert className={detectedZone === 'urban' ? 'border-primary' : 'border-muted'}>
              <MapPin className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  {t('offlineid_detected_zone')}: <strong>{detectedZone === 'urban' ? t('offlineid_zone_urban') : t('offlineid_zone_rural')}</strong>
                </span>
                <Badge variant={detectedZone === 'urban' ? 'default' : 'secondary'}>
                  {t('offlineid_grid')} {gridSize}m
                </Badge>
              </AlertDescription>
            </Alert>

            {/* GPS Location */}
            <div className="space-y-2">
              <Label>{t('offlineid_gps_coordinates')}</Label>
              <div className="flex gap-2">
                <Button
                  onClick={getCurrentPosition}
                  disabled={gpsLoading}
                  variant="outline"
                  className="flex-1"
                >
                  <MapPin className={`h-4 w-4 mr-2 ${gpsLoading ? 'animate-pulse' : ''}`} />
                  {gpsLoading ? t('offlineid_getting') : coordinates ? t('offlineid_update') : t('offlineid_capture_gps')}
                </Button>
              </div>
              
              {coordinates && (
                <div className="text-sm bg-muted p-3 rounded-md space-y-1">
                  <p><strong>{t('offlineid_latitude')}:</strong> {coordinates.latitude.toFixed(6)}</p>
                  <p><strong>{t('offlineid_longitude')}:</strong> {coordinates.longitude.toFixed(6)}</p>
                  {coordinates.accuracy && (
                    <p className="text-muted-foreground">{t('offlineid_accuracy')}: ±{coordinates.accuracy.toFixed(0)}m</p>
                  )}
                </div>
              )}
            </div>

            {/* Country */}
            <div className="space-y-2">
              <Label htmlFor="country">{t('offlineid_country')} *</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AO">{t('offlineid_country_ao')}</SelectItem>
                  <SelectItem value="CD">{t('offlineid_country_cd')}</SelectItem>
                  <SelectItem value="CG">{t('offlineid_country_cg')}</SelectItem>
                  <SelectItem value="MZ">{t('offlineid_country_mz')}</SelectItem>
                  <SelectItem value="ZM">{t('offlineid_country_zm')}</SelectItem>
                  <SelectItem value="ZW">{t('offlineid_country_zw')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Administrative Levels */}
            <div className="space-y-2">
              <Label htmlFor="level1">{t('offlineid_level1_label')} *</Label>
              <Input
                id="level1"
                value={level1Name}
                onChange={(e) => setLevel1Name(e.target.value)}
                placeholder={t('offlineid_level1_placeholder')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="level2">{t('offlineid_level2_label')}</Label>
              <Input
                id="level2"
                value={level2Name}
                onChange={(e) => setLevel2Name(e.target.value)}
                placeholder={t('offlineid_level2_placeholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="level3">{t('offlineid_level3_label')}</Label>
              <Input
                id="level3"
                value={level3Name}
                onChange={(e) => setLevel3Name(e.target.value)}
                placeholder={t('offlineid_level3_placeholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="level4">{t('offlineid_level4_label')}</Label>
              <Input
                id="level4"
                value={level4Name}
                onChange={(e) => setLevel4Name(e.target.value)}
                placeholder={t('offlineid_level4_placeholder')}
              />
            </div>

            {/* Tipo de endereço — INDICADO pelo utilizador (o sistema não o deteta) */}
            <div className="space-y-2">
              <Label htmlFor="addressType">{t('createid_address_type_label')} <span className="text-destructive">*</span></Label>
              <Select value={addressType} onValueChange={(v) => setAddressType(v as 'formal' | 'informal')}>
                <SelectTrigger id="addressType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informal">{t('createid_addrtype_informal')}</SelectItem>
                  <SelectItem value="formal">{t('createid_addrtype_formal')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('createid_address_type_hint')}</p>
            </div>

            {/* Street Address */}
            <div className="space-y-2">
              <Label htmlFor="street">{t('offlineid_street_label')}</Label>
              <Input
                id="street"
                value={streetName}
                onChange={(e) => setStreetName(e.target.value)}
                placeholder={t('offlineid_street_placeholder')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="number">{t('offlineid_number_label')}</Label>
                <Input
                  id="number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="123"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">{t('offlineid_unit_label')}</Label>
                <Input
                  id="unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="A"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="property">{t('offlineid_property_type_label')}</Label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger>
                  <SelectValue placeholder={t('offlineid_property_type_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residencia">{t('offlineid_property_residencia')}</SelectItem>
                  <SelectItem value="comercial">{t('offlineid_property_comercial')}</SelectItem>
                  <SelectItem value="industrial">{t('offlineid_property_industrial')}</SelectItem>
                  <SelectItem value="terreno">{t('offlineid_property_terreno')}</SelectItem>
                  <SelectItem value="misto">{t('offlineid_property_misto')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Witnesses Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t('offlineid_witnesses')}</Label>
                <Badge variant="secondary">
                  <Users className="h-3 w-3 mr-1" />
                  {witnesses.length}
                </Badge>
              </div>
              
              {witnesses.length > 0 && (
                <div className="space-y-2 mb-4">
                  {witnesses.map((witness, idx) => (
                    <div key={idx} className="bg-muted/50 border border-border rounded-md p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-mono text-sm font-semibold">{witness.witness_afro_id}</p>
                          {witness.witness_name && (
                            <p className="text-sm text-muted-foreground">{witness.witness_name}</p>
                          )}
                          <Badge variant="outline" className="mt-1 text-xs">
                            {witness.validation_method === 'otp' && t('offlineid_validation_otp')}
                            {witness.validation_method === 'signature' && t('offlineid_validation_signature')}
                            {witness.validation_method === 'photo' && t('offlineid_validation_photo')}
                            {witness.validation_method === 'in_person' && t('offlineid_validation_in_person')}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setWitnesses(witnesses.filter((_, i) => i !== idx))}
                          className="h-6 w-6"
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <OfflineWitnessCapture
                onWitnessAdded={(witness) => setWitnesses([...witnesses, witness])}
                witnessCount={witnesses.length}
              />
            </div>

            {/* Quota warning */}
            {operatorMode && quotaRemaining <= 5 && quotaRemaining > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {t('offlineid_quota_warning_prefix')} {quotaRemaining} {quotaRemaining !== 1 ? t('offlineid_quota_warning_plural') : t('offlineid_quota_warning_singular')}
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleSave}
              disabled={saving || !level1Name || (operatorMode && quotaRemaining <= 0)}
              className="w-full"
              size="lg"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? t('offlineid_saving') : t('offlineid_save_offline')}
            </Button>

            <div className="flex gap-2">
              <Button
                onClick={() => navigate("/offline-sync")}
                variant="outline"
                className="flex-1"
              >
                {t('offlineid_view_records')} ({offlineCount})
              </Button>
              
              {!operatorMode && (
                <Button
                  onClick={enableOperatorMode}
                  variant="secondary"
                  className="flex-1"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  {t('offlineid_operator_mode')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
