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

export default function OfflineCreateIdentity() {
  const navigate = useNavigate();
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
      title: "Modo Operador Activado",
      description: `Quota diária: ${config.daily_quota} registos`,
    });
  };

  const handleSave = async () => {
    if (!userId) {
      toast({
        title: "Erro",
        description: "É necessário estar autenticado",
        variant: "destructive",
      });
      return;
    }

    if (!country || !level1Name) {
      toast({
        title: "Campos Obrigatórios",
        description: "País e Região são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    // Check operator quota
    if (operatorMode) {
      const { allowed, remaining } = await incrementOperatorCount(userId);
      if (!allowed) {
        toast({
          title: "Quota Esgotada",
          description: "Atingiu o limite diário de registos. Tente novamente amanhã.",
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
        title: "Guardado Offline",
        description: (
          <div className="space-y-1">
            <p className="font-mono text-sm font-bold">{code}</p>
            <p className="text-xs text-muted-foreground">
              {count} registo{count !== 1 ? 's' : ''} pendente{count !== 1 ? 's' : ''} de sincronização
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
        title: "Erro ao Guardar",
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
                Online ({networkType})
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="h-3 w-3" />
                Offline
              </Badge>
            )}
            
            {offlineCount > 0 && (
              <Badge variant="secondary">
                {offlineCount} pendente{offlineCount !== 1 ? 's' : ''}
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
                  <span className="font-semibold text-sm">Modo Operador de Campo</span>
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
                {operatorConfig.records_today} de {operatorConfig.daily_quota} registos hoje
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Criar Endereço AFROLOC (Modo Offline)</CardTitle>
            <CardDescription>
              Capture dados de localização sem internet. Os registos sincronizam automaticamente quando conectar.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Zone Detection Alert */}
            <Alert className={detectedZone === 'urban' ? 'border-primary' : 'border-muted'}>
              <MapPin className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  Zona detectada: <strong>{detectedZone === 'urban' ? 'Urbana' : 'Rural'}</strong>
                </span>
                <Badge variant={detectedZone === 'urban' ? 'default' : 'secondary'}>
                  Grelha {gridSize}m
                </Badge>
              </AlertDescription>
            </Alert>

            {/* GPS Location */}
            <div className="space-y-2">
              <Label>Coordenadas GPS</Label>
              <div className="flex gap-2">
                <Button
                  onClick={getCurrentPosition}
                  disabled={gpsLoading}
                  variant="outline"
                  className="flex-1"
                >
                  <MapPin className={`h-4 w-4 mr-2 ${gpsLoading ? 'animate-pulse' : ''}`} />
                  {gpsLoading ? 'A obter...' : coordinates ? 'Actualizar' : 'Capturar GPS'}
                </Button>
              </div>
              
              {coordinates && (
                <div className="text-sm bg-muted p-3 rounded-md space-y-1">
                  <p><strong>Latitude:</strong> {coordinates.latitude.toFixed(6)}</p>
                  <p><strong>Longitude:</strong> {coordinates.longitude.toFixed(6)}</p>
                  {coordinates.accuracy && (
                    <p className="text-muted-foreground">Precisão: ±{coordinates.accuracy.toFixed(0)}m</p>
                  )}
                </div>
              )}
            </div>

            {/* Country */}
            <div className="space-y-2">
              <Label htmlFor="country">País *</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AO">Angola</SelectItem>
                  <SelectItem value="CD">República Democrática do Congo</SelectItem>
                  <SelectItem value="CG">República do Congo</SelectItem>
                  <SelectItem value="MZ">Moçambique</SelectItem>
                  <SelectItem value="ZM">Zâmbia</SelectItem>
                  <SelectItem value="ZW">Zimbabué</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Administrative Levels */}
            <div className="space-y-2">
              <Label htmlFor="level1">Província/Região *</Label>
              <Input
                id="level1"
                value={level1Name}
                onChange={(e) => setLevel1Name(e.target.value)}
                placeholder="ex: Luanda"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="level2">Município/Distrito</Label>
              <Input
                id="level2"
                value={level2Name}
                onChange={(e) => setLevel2Name(e.target.value)}
                placeholder="ex: Belas"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="level3">Comuna/Sector</Label>
              <Input
                id="level3"
                value={level3Name}
                onChange={(e) => setLevel3Name(e.target.value)}
                placeholder="ex: Talatona"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="level4">Bairro/Aldeia</Label>
              <Input
                id="level4"
                value={level4Name}
                onChange={(e) => setLevel4Name(e.target.value)}
                placeholder="ex: Nova Vida"
              />
            </div>

            {/* Street Address */}
            <div className="space-y-2">
              <Label htmlFor="street">Nome da Rua</Label>
              <Input
                id="street"
                value={streetName}
                onChange={(e) => setStreetName(e.target.value)}
                placeholder="ex: Avenida 21 de Janeiro"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="number">Número</Label>
                <Input
                  id="number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="123"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unidade/Apt</Label>
                <Input
                  id="unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="A"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="property">Tipo de Propriedade</Label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residencia">Residência</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                  <SelectItem value="terreno">Terreno</SelectItem>
                  <SelectItem value="misto">Uso Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Witnesses Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Testemunhas</Label>
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
                            {witness.validation_method === 'otp' && 'SMS OTP (na fila)'}
                            {witness.validation_method === 'signature' && 'Assinatura capturada'}
                            {witness.validation_method === 'photo' && 'Foto ID capturada'}
                            {witness.validation_method === 'in_person' && 'Verificado presencialmente'}
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
                  Atenção: Apenas {quotaRemaining} registo{quotaRemaining !== 1 ? 's' : ''} restante{quotaRemaining !== 1 ? 's' : ''} na quota diária.
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
              {saving ? 'A guardar...' : 'Guardar Offline'}
            </Button>

            <div className="flex gap-2">
              <Button
                onClick={() => navigate("/offline-sync")}
                variant="outline"
                className="flex-1"
              >
                Ver Registos ({offlineCount})
              </Button>
              
              {!operatorMode && (
                <Button
                  onClick={enableOperatorMode}
                  variant="secondary"
                  className="flex-1"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Modo Operador
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
