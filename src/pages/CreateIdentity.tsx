import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, MapPin, Sparkles, ArrowLeft, Package, Timer } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import DeliveryChannels from "@/components/DeliveryChannels";
import LocationMap from "@/components/LocationMap";
import { useLanguage } from "@/contexts/LanguageContext";
import { COUNTRIES, getCountryByCode } from "@/utils/countryConfig";
import { useGPSValidation } from "@/hooks/useGPSValidation";
import { useAdminDivisionResolver } from "@/hooks/useAdminDivisionResolver";
import PropertyPhotoCapture from "@/components/PropertyPhotoCapture";
import RequesterLookup, { RequesterProfile } from "@/components/RequesterLookup";
import { ExifData } from "@/hooks/useExifExtractor";
import { CompressionResult } from "@/utils/imageCompression";

const COUNTRIES_LIST = COUNTRIES.map(c => ({ code: c.code, name: c.name }));

export default function CreateIdentity() {
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState("");
  const [level1Code, setLevel1Code] = useState("");
  const [level1Name, setLevel1Name] = useState("");
  const [level2Code, setLevel2Code] = useState("");
  const [level2Name, setLevel2Name] = useState("");
  const [level3Code, setLevel3Code] = useState("");
  const [level3Name, setLevel3Name] = useState("");
  const [level4Name, setLevel4Name] = useState("");
  const [streetName, setStreetName] = useState("");
  const [number, setNumber] = useState("");
  const [unit, setUnit] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [isTemporary, setIsTemporary] = useState(false);
  const [temporaryDays, setTemporaryDays] = useState("30");
  const [isYamiooAgent, setIsYamiooAgent] = useState(false);
  const [selectedRequester, setSelectedRequester] = useState<RequesterProfile | null>(null);
  const [geoLat, setGeoLat] = useState("");
  const [geoLon, setGeoLon] = useState("");
  const [mapCenter, setMapCenter] = useState<[number, number]>([13.2344, -8.8383]);
  const [mapZoom, setMapZoom] = useState(6);
  
  // Administrative divisions from database
  const [provinces, setProvinces] = useState<Array<{code: string, name: string}>>([]);
  const [municipalities, setMunicipalities] = useState<Array<{code: string, name: string}>>([]);
  const [communes, setCommunes] = useState<Array<{code: string, name: string}>>([]);
  
  // Photo capture state
  // NOTE: store only a UI preview URL in React state to avoid freezes.
  // We use a blob: URL from compression (fast to render) and revoke it on change.
  const [propertyPhotoUrl, setPropertyPhotoUrl] = useState<string | null>(null);
  const previousPhotoUrlRef = useRef<string | null>(null);
  const [photoExif, setPhotoExif] = useState<ExifData | null>(null);
  const [photoStats, setPhotoStats] = useState<CompressionResult | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { validateAndNotify } = useGPSValidation();
  const { resolveFromCoordinates, loading: resolvingAdmin } = useAdminDivisionResolver();

  const handleLocationSelect = async (lat: number, lon: number) => {
    // Validate coordinates before setting
    if (country) {
      const isValid = await validateAndNotify(country, lat, lon);
      if (!isValid) {
        return;
      }
    }
    setGeoLat(lat.toFixed(6));
    setGeoLon(lon.toFixed(6));

    // Auto-resolve administrative hierarchy from coordinates
    if (country) {
      const resolved = await resolveFromCoordinates(country, lat, lon);
      if (resolved) {
        // Auto-fill province if found and not already selected
        if (resolved.level1 && !level1Code) {
          setLevel1Code(resolved.level1.code);
          setLevel1Name(resolved.level1.name);

          // Need to load municipalities + communes for this province
          await loadMunicipalities(country, resolved.level1.code);
          await loadCommunes(country, resolved.level1.code);
        }
        
        // Auto-fill municipality if found and not already selected  
        if (resolved.level2 && !level2Code) {
          setLevel2Code(resolved.level2.code);
          setLevel2Name(resolved.level2.name);
          // Comunas já foram carregadas ao nível da província acima.
        }
        
        // Auto-fill commune if found and not already selected
        if (resolved.level3 && !level3Code) {
          setLevel3Code(resolved.level3.code);
          setLevel3Name(resolved.level3.name);
        }

        // Show toast with zone info
        toast({
          title: "Localização identificada",
          description: `Zona: ${resolved.zone === 'urban' ? 'Urbana' : 'Rural'} (${resolved.gridSize}m) ${resolved.level1?.name || ''} ${resolved.level2?.name ? '> ' + resolved.level2.name : ''}`,
        });
      }
    }
  };

  useEffect(() => {
    checkAuthAndLoadProfile();
  }, []);

  // Load provinces when country changes
  useEffect(() => {
    if (country) {
      loadProvinces(country);
    }
  }, [country]);

  // Load municipalities when province changes
  useEffect(() => {
    if (country && level1Code) {
      loadMunicipalities(country, level1Code);
    } else {
      setMunicipalities([]);
    }
  }, [country, level1Code]);

  // Load communes when province changes (comunas 2024 têm parent = província)
  useEffect(() => {
    if (country && level1Code) {
      loadCommunes(country, level1Code);
    } else {
      setCommunes([]);
    }
  }, [country, level1Code]);

  // Clear number when street name is removed (digital address)
  useEffect(() => {
    if (!streetName) {
      setNumber('');
    }
  }, [streetName]);

  // Revoke previous blob URLs to avoid memory leaks
  useEffect(() => {
    const prev = previousPhotoUrlRef.current;
    if (prev && prev.startsWith('blob:') && prev !== propertyPhotoUrl) {
      URL.revokeObjectURL(prev);
    }
    previousPhotoUrlRef.current = propertyPhotoUrl;
  }, [propertyPhotoUrl]);

  const loadProvinces = async (countryCode: string) => {
    const { data } = await supabase
      .from('administrative_divisions')
      .select('code, name')
      .eq('country_code', countryCode)
      .eq('level', 1)
      .order('name');
    setProvinces(data || []);
  };

  const loadMunicipalities = async (countryCode: string, provinceCode: string) => {
    const { data } = await supabase
      .from('administrative_divisions')
      .select('code, name')
      .eq('country_code', countryCode)
      .eq('level', 2)
      .eq('parent_code', provinceCode)
      .order('name');
    setMunicipalities(data || []);
  };

  // NOTA: as comunas da reforma de 2024 (Lei 14/24) estão registadas com
  // parent = PROVÍNCIA (o Anexo I da lei lista as comunas por província; o
  // mapeamento comuna→município só existe nos mapas-imagem e será afinado
  // depois via OCR). Por isso filtramos por província, não por município.
  const loadCommunes = async (countryCode: string, provinceCode: string) => {
    const { data } = await supabase
      .from('administrative_divisions')
      .select('code, name')
      .eq('country_code', countryCode)
      .eq('level', 3)
      .eq('parent_code', provinceCode)
      .order('name');
    setCommunes(data || [])
  };

  const checkAuthAndLoadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return;
    }

    // Load user profile to get country
    const { data: profile } = await supabase
      .from("profiles")
      .select("country, city, full_name")
      .eq("user_id", session.user.id)
      .single();

    if (profile?.country) {
      setCountry(profile.country);
      const countryConfig = getCountryByCode(profile.country);
      if (countryConfig) {
        setMapCenter(countryConfig.center);
        setMapZoom(countryConfig.zoom);
      }
    }

    // Check if user is a yamioo agent
    const { data: agentRecord } = await supabase
      .from("yamioo_agents")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("is_active", true)
      .maybeSingle();

    setIsYamiooAgent(!!agentRecord);
  };

  // Determinar se é endereço digital (sem rua/número formal)
  const isDigitalAddress = !streetName;
  
  // Extract municipality short code from full code (e.g., "LUA-ING" -> "ING")
  const getMunicipalityShortCode = (fullCode: string): string => {
    const parts = fullCode.split('-');
    return parts.length > 1 ? parts[1] : fullCode.substring(0, 3);
  };

  // Extract commune short code
  const getCommuneShortCode = (fullCode: string): string => {
    const parts = fullCode.split('-');
    return parts.length > 2 ? parts[2] : parts.length > 1 ? parts[1] : fullCode.substring(0, 3);
  };
  
  // Gerar preview do código (síncrono, para UI)
  const generateCodePreview = (): string => {
    if (!country || !level1Code || !level2Code) {
      return 'PREENCHA_OS_CAMPOS';
    }
    
    const cc = country.toUpperCase();
    const munShort = getMunicipalityShortCode(level2Code);
    const baiCode = isDigitalAddress ? 'DIG' : (level4Name?.substring(0, 3).toUpperCase() || 'XXX');
    
    if (geoLat && geoLon) {
      // Formato oficial: CC-PROV-MUN-COM-BAI-G10-X-Y
      return `${cc}-${level1Code}-${munShort}-${level3Code || 'XXX'}-${baiCode}-G10-...`;
    }
    return `${cc}-${level1Code}-${munShort}-GPS_REQUIRED`;
  };
  
  // Gerar código oficial via qg-engine (async, para submit)
  const generateOfficialCode = async (): Promise<string> => {
    if (!geoLat || !geoLon) {
      throw new Error('GPS coordinates required');
    }
    
    if (!level1Code || !level2Code) {
      throw new Error('Province and Municipality are required');
    }
    
    try {
      const munShort = getMunicipalityShortCode(level2Code);
      const comShort = level3Code ? getCommuneShortCode(level3Code) : munShort;
      const baiCode = isDigitalAddress ? 'DIG' : (level4Name?.substring(0, 3).toUpperCase() || comShort);
      
      const { data, error } = await supabase.functions.invoke('qg-engine', {
        body: {
          action: 'encode',
          latitude: parseFloat(geoLat),
          longitude: parseFloat(geoLon),
          countryCode: country,
          provinceCode: level1Code,
          municipalityCode: munShort,
          communeCode: comShort,
          neighborhoodCode: baiCode,
          registrationType: isDigitalAddress ? 'digital' : 'formal',
          cellType: 'auto'
        }
      });
      
      if (error) throw error;
      if (!data?.afroloc) throw new Error('No AFROLOC code returned');
      return data.afroloc;
    } catch (err) {
      console.error('Error generating AFROLOC code:', err);
      // Fallback local - use correct administrative codes
      const cc = country.toUpperCase();
      const munShort = getMunicipalityShortCode(level2Code);
      const comShort = level3Code ? getCommuneShortCode(level3Code) : munShort;
      const baiCode = isDigitalAddress ? 'DIG' : (level4Name?.substring(0, 3).toUpperCase() || comShort);
      return `${cc}-${level1Code}-${munShort}-${comShort}-${baiCode}-G10-LOCAL-LOCAL`;
    }
  };

  const getCurrentLocation = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          
          // Use handleLocationSelect to also resolve admin hierarchy
          await handleLocationSelect(lat, lon);
        },
        (error) => {
          toast({
            title: "Erro",
            description: "Não foi possível obter a localização atual",
            variant: "destructive",
          });
        }
      );
    }
  };

  const handlePhotoCapture = async (
    photoPreviewUrl: string,
    exif: ExifData | null,
    stats: CompressionResult,
    gps: { lat: number; lon: number } | null
  ) => {
    setPropertyPhotoUrl(photoPreviewUrl);
    setPhotoExif(exif);
    setPhotoStats(stats);

    // If photo has GPS and we don't have coords yet, use photo GPS and resolve admin
    if (gps && !geoLat && !geoLon) {
      await handleLocationSelect(gps.lat, gps.lon);
    }
  };


  const handleRemovePhoto = () => {
    if (propertyPhotoUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(propertyPhotoUrl);
    }
    setPropertyPhotoUrl(null);
    setPhotoExif(null);
    setPhotoStats(null);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Yamioo agents must select a requester first
    if (isYamiooAgent && !selectedRequester) {
      toast({
        title: "Solicitante Obrigatório",
        description: "Pesquise e selecione o solicitante antes de criar o endereço.",
        variant: "destructive",
      });
      return;
    }

    // Property type is REQUIRED
    if (!propertyType) {
      toast({
        title: "Tipo de Propriedade Obrigatório",
        description: "Por favor, seleccione o tipo de propriedade (Residência, Apartamento, Comercial, etc.)",
        variant: "destructive",
      });
      return;
    }
    
    // For formal addresses (with street name), number is required
    const isDigitalAddress = !streetName;
    const numberRequired = !isDigitalAddress;
    
    if (!country || !level1Code || !level2Code || !geoLat || !geoLon) {
      toast({
        title: "Informação Incompleta",
        description: "Por favor, seleccione a província e o município, e capture as coordenadas GPS",
        variant: "destructive",
      });
      return;
    }
    
    if (numberRequired && !number) {
      toast({
        title: "Número Obrigatório",
        description: "Para endereços formais (com nome de rua), o número é obrigatório",
        variant: "destructive",
      });
      return;
    }

    // Validate GPS coordinates are within country boundaries
    const latitude = parseFloat(geoLat);
    const longitude = parseFloat(geoLon);

    setLoading(true);

    const isValid = await validateAndNotify(country, latitude, longitude);
    if (!isValid) {
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if coordinates already exist in the database
      // Use a small tolerance for GPS precision (~10 meters = 0.0001 degrees)
      const tolerance = 0.0001;
      const { data: existingRecords, error: checkError } = await supabase
        .from("afroloc_records")
        .select("id, code, property_type, unit")
        .gte("geo_lat", latitude - tolerance)
        .lte("geo_lat", latitude + tolerance)
        .gte("geo_lon", longitude - tolerance)
        .lte("geo_lon", longitude + tolerance);

      if (checkError) {
        console.error("Error checking existing records:", checkError);
      }

      // If records exist at this location
      if (existingRecords && existingRecords.length > 0) {
        // Only apartments/buildings can have multiple registrations at same coordinates
        const isApartmentOrBuilding = propertyType === 'apartment';
        
        if (!isApartmentOrBuilding) {
          // For non-apartment types, check if there's already a non-apartment record
          const existingNonApartment = existingRecords.find(r => r.property_type !== 'apartment');
          if (existingNonApartment) {
            toast({
              title: "Localização Já Registada",
              description: "Já existe um endereço AFROLOC nesta localização. Apenas apartamentos/prédios podem ter múltiplos registos nas mesmas coordenadas.",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
        }
        
        // For apartments, require unit number to differentiate
        if (isApartmentOrBuilding && !unit) {
          toast({
            title: "Unidade/Apartamento Obrigatório",
            description: "Para registar um apartamento numa localização com registos existentes, é necessário informar o número da unidade/apartamento.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        // Check if same unit already exists
        if (isApartmentOrBuilding && unit) {
          const existingSameUnit = existingRecords.find(r => r.unit?.toLowerCase() === unit.toLowerCase());
          if (existingSameUnit) {
            toast({
              title: "Apartamento Já Registado",
              description: `O apartamento/unidade "${unit}" já está registado nesta localização.`,
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
        }
      }

      const code = await generateOfficialCode();

      const { data: insertedRecord, error } = await supabase.from("afroloc_records").insert({
        code,
        country,
        level1_code: level1Code,
        level1_name: level1Name,
        level2_code: level2Code,
        level2_name: level2Name,
        level3_code: level3Code || null,
        level3_name: level3Name || null,
        level4_code: level4Name ? level4Name.substring(0, 3).toUpperCase() : null,
        level4_name: level4Name || null,
        street_code: streetName ? streetName.substring(0, 2).toUpperCase() : null,
        street_name: streetName || null,
        number: number || null,
        unit: unit || null,
        property_type: propertyType,
        property_name: propertyName || null,
        geo_lat: latitude,
        geo_lon: longitude,
        user_id: isYamiooAgent && selectedRequester ? selectedRequester.user_id : user.id,
        registered_by_user_id: isYamiooAgent ? user.id : null,
        status: "draft",
        // Temporary address fields
        ...(isTemporary ? {
          is_temporary: true,
          temporary_validity_days: parseInt(temporaryDays),
          temporary_expires_at: new Date(Date.now() + parseInt(temporaryDays) * 86400000).toISOString(),
          temporary_granted_by: user.id,
        } as any : {}),
        // EXIF data from property photo
        photo_exif_gps_lat: photoExif?.latitude || null,
        photo_exif_gps_lon: photoExif?.longitude || null,
        photo_exif_device_make: photoExif?.deviceMake || null,
        photo_exif_device_model: photoExif?.deviceModel || null,
        photo_exif_timestamp: photoExif?.timestamp || null,
      }).select('id').single();

      if (error) throw error;

      // Upload property photo to storage if captured
      if (propertyPhotoUrl && insertedRecord?.id) {
        try {
          const timestamp = Date.now();
          const fileName = `property_${timestamp}.jpg`;
          const storagePath = `${user.id}/${insertedRecord.id}/${fileName}`;

          // Convert blob URL or data URL to Blob
          const response = await fetch(propertyPhotoUrl);
          const blob = await response.blob();

          const { error: uploadError } = await supabase.storage
            .from('property-photos')
            .upload(storagePath, blob, {
              contentType: 'image/jpeg',
              upsert: false,
            });

          if (uploadError) {
            console.error('Photo upload error:', uploadError);
          } else {
            // Update record with photo_metadata containing file_path
            const photoMeta: { file_path: string; captured_at: string } = {
              file_path: storagePath,
              captured_at: new Date().toISOString(),
            };
            await supabase
              .from('afroloc_records')
              .update({
                photo_metadata: photoMeta as unknown as import('@/integrations/supabase/types').Json,
              })
              .eq('id', insertedRecord.id);
          }
        } catch (photoErr) {
          console.error('Error uploading property photo:', photoErr);
          // Don't fail the whole creation if photo upload fails
        }
      }

      toast({
        title: "Sucesso",
        description: "AFROLOC criado com sucesso",
      });
      navigate("/identities");
    } catch (error: any) {
      console.error("Error creating AFROLOC:", error);
      
      // Detailed error handling with user-friendly messages
      let errorTitle = "Erro ao Criar AFROLOC";
      let errorDescription = "";
      
      const errorMsg = error.message?.toLowerCase() || '';
      const errorCode = error.code || '';
      
      if (errorMsg.includes('maximum limit') || errorMsg.includes('afroloc addresses per user')) {
        errorTitle = "⚠️ Limite de Endereços Atingido";
        errorDescription = "Você já possui o número máximo de 10 endereços AFROLOC registados. Para adicionar um novo endereço, por favor exclua um dos existentes na sua lista de identidades.";
      } else if (errorMsg.includes('duplicate key') || errorMsg.includes('afroid_records_code_key') || errorCode === '23505') {
        errorTitle = "🔄 Código AFROLOC Duplicado";
        errorDescription = "O código AFROLOC gerado para esta localização já existe no sistema. Isto pode acontecer quando duas pessoas registam o mesmo local simultaneamente. Por favor, aguarde alguns segundos e tente novamente.";
      } else if (errorMsg.includes('not authenticated') || errorMsg.includes('jwt') || errorCode === 'PGRST301') {
        errorTitle = "🔐 Sessão Expirada";
        errorDescription = "A sua sessão expirou. Por favor, faça login novamente para continuar o registo.";
      } else if (errorMsg.includes('permission denied') || errorMsg.includes('rls') || errorCode === '42501') {
        errorTitle = "🚫 Permissão Negada";
        errorDescription = "Você não tem permissão para criar endereços AFROLOC. Verifique se está logado com a conta correcta ou contacte o suporte.";
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('connection')) {
        errorTitle = "📡 Erro de Conexão";
        errorDescription = "Não foi possível conectar ao servidor. Verifique a sua conexão à internet e tente novamente.";
      } else if (errorMsg.includes('timeout')) {
        errorTitle = "⏱️ Tempo Esgotado";
        errorDescription = "O servidor demorou muito a responder. Por favor, tente novamente em alguns instantes.";
      } else if (errorMsg.includes('invalid') || errorMsg.includes('validation')) {
        errorTitle = "❌ Dados Inválidos";
        errorDescription = "Alguns dados fornecidos são inválidos. Verifique todos os campos e tente novamente.";
      } else if (errorMsg.includes('foreign key') || errorCode === '23503') {
        errorTitle = "📋 Referência Inválida";
        errorDescription = "Alguns dados de referência (província, município, etc.) são inválidos. Por favor, seleccione novamente os campos de localização.";
      } else {
        // Generic error with technical details for debugging
        errorTitle = "❌ Erro Inesperado";
        errorDescription = `Ocorreu um erro ao criar o seu endereço AFROLOC. Detalhes técnicos: ${error.message || 'Erro desconhecido'}. Se o problema persistir, contacte o suporte.`;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      {/* Background mesh gradient */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-mesh opacity-50 -z-10"></div>
      
      <div className="max-w-5xl mx-auto relative">
        {/* Hero Header */}
        <div className="mb-8 animate-fade-in">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/identities")}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Recuar
          </Button>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 shadow-premium">
            <div className="absolute inset-0 bg-dots-pattern opacity-10"></div>
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary-glow/20 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 flex items-start gap-4">
              <div className="animate-float">
                <div className="p-4 rounded-2xl bg-white/20 backdrop-blur-sm shadow-xl">
                  <MapPin className="h-10 w-10 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-display font-bold text-white mb-2">
                  Criar Nova Identidade
                </h1>
                <p className="text-white/90 text-lg">
                  Gere seu endereço digital AFROLOC único e verificável
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Requester lookup for Yamioo agents */}
        {isYamiooAgent && (
          <div className="mb-6">
            <RequesterLookup
              onSelect={setSelectedRequester}
              selectedProfile={selectedRequester}
              onClear={() => setSelectedRequester(null)}
            />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form - 2 columns */}
          <Card className="lg:col-span-2 glass-strong border border-border/50 shadow-premium">
            <CardHeader>
              <CardTitle className="text-2xl font-display flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-primary animate-float">
                  <Save className="h-5 w-5 text-white" />
                </div>
                Informações do Endereço
              </CardTitle>
              <CardDescription className="text-base">
                Preencha os detalhes da sua localização
              </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="country">País</Label>
                      <Select value={country} onValueChange={setCountry} required>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione o país" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES_LIST.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Address Type Information */}
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-blue-100 dark:bg-blue-900/50 p-2 flex-shrink-0">
                          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                            Tipos de Endereço
                          </h4>
                          <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                            O sistema distingue automaticamente entre três tipos de endereços:
                          </p>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-start gap-2">
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex-shrink-0">🏛️ Formal:</span>
                              <span className="text-blue-700 dark:text-blue-300">
                                Endereços com ruas e números oficialmente atribuídos pelas administrações governamentais
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-amber-600 dark:text-amber-400 font-bold flex-shrink-0">📍 Informal:</span>
                              <span className="text-blue-700 dark:text-blue-300">
                                Endereços sem nome de rua ou número oficial atribuído
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">🌐 Digital:</span>
                              <span className="text-blue-700 dark:text-blue-300">
                                Tipo atribuído após certificação por autoridades (substitui Formal/Informal)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="level1">Província / Estado <span className="text-destructive">*</span></Label>
                        <Select 
                          value={level1Code} 
                          onValueChange={(value) => {
                            const province = provinces.find(p => p.code === value);
                            setLevel1Code(value);
                            setLevel1Name(province?.name || '');
                            // Reset dependent fields
                            setLevel2Code('');
                            setLevel2Name('');
                            setLevel3Code('');
                            setLevel3Name('');
                          }}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione a província" />
                          </SelectTrigger>
                          <SelectContent>
                            {provinces.map(p => (
                              <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="level2">Município / Distrito <span className="text-destructive">*</span></Label>
                        <Select 
                          value={level2Code} 
                          onValueChange={(value) => {
                            const municipality = municipalities.find(m => m.code === value);
                            setLevel2Code(value);
                            setLevel2Name(municipality?.name || '');
                            // Reset dependent fields
                            setLevel3Code('');
                            setLevel3Name('');
                          }}
                          disabled={!level1Code}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={level1Code ? "Seleccione o município" : "Primeiro seleccione a província"} />
                          </SelectTrigger>
                          <SelectContent>
                            {municipalities.map(m => (
                              <SelectItem key={m.code} value={m.code}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="level3">Comuna / Localidade</Label>
                        <Select 
                          value={level3Code} 
                          onValueChange={(value) => {
                            const commune = communes.find(c => c.code === value);
                            setLevel3Code(value);
                            setLevel3Name(commune?.name || '');
                          }}
                          disabled={!level2Code || communes.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={communes.length === 0 ? "Nenhuma comuna disponível" : "Opcional"} />
                          </SelectTrigger>
                          <SelectContent>
                            {communes.map(c => (
                              <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="level4">Bairro / Aldeia</Label>
                        <Input
                          id="level4"
                          value={level4Name}
                          onChange={(e) => setLevel4Name(e.target.value)}
                          placeholder="Opcional"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="street">
                          Street Name 
                          <span className="text-xs text-muted-foreground ml-1">(Para endereço formal)</span>
                        </Label>
                        <Input
                          id="street"
                          value={streetName}
                          onChange={(e) => setStreetName(e.target.value)}
                          placeholder="Ex: Rua 1º de Maio"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Preencha se a rua tem nome oficial
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="number">
                          Número
                          {streetName && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        {streetName ? (
                          <Input
                            id="number"
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            placeholder="Ex: 123"
                            required
                          />
                        ) : (
                          <div className="space-y-2">
                            <Input
                              id="number"
                              value={number}
                              onChange={(e) => setNumber(e.target.value)}
                              placeholder="Será atribuído pela Administração"
                              disabled
                              className="bg-muted"
                            />
                            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                              <p className="text-xs text-amber-800 dark:text-amber-200">
                                <strong>📍 Endereço Digital:</strong> O número será atribuído pela Administração do Estado após o agendamento e confirmação do seu registo.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="unit">Unidade / Apartamento</Label>
                        <Input
                          id="unit"
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          placeholder="Opcional"
                        />
                      </div>
                      <div>
                        <Label htmlFor="propertyName">
                          Nome da Propriedade
                          <span className="text-xs text-muted-foreground ml-1">(ex: Condomínio, Edifício)</span>
                        </Label>
                        <Input
                          id="propertyName"
                          value={propertyName}
                          onChange={(e) => setPropertyName(e.target.value)}
                          placeholder="Ex: Condomínio Paraíso Real"
                        />
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          ⚠️ Auto-atribuído — não verificado oficialmente
                        </p>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="propertyType">
                        Tipo de Propriedade <span className="text-destructive">*</span>
                      </Label>
                      <Select value={propertyType} onValueChange={setPropertyType} required>
                        <SelectTrigger className={!propertyType ? "border-amber-500" : ""}>
                          <SelectValue placeholder="Seleccione o tipo de propriedade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="house">🏠 Residência (Moradia Individual)</SelectItem>
                          <SelectItem value="apartment">🏢 Apartamento (Prédio/Edifício)</SelectItem>
                          <SelectItem value="commercial">🏪 Comercial</SelectItem>
                          <SelectItem value="land">🌍 Terreno</SelectItem>
                          <SelectItem value="other">📍 Outro</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {propertyType === 'apartment' 
                          ? "💡 Apartamentos permitem múltiplos registos na mesma localização (com unidades diferentes)"
                          : "⚠️ Residências, comerciais e terrenos só permitem um registo por localização"
                        }
                      </p>
                    </div>

                    {/* Temporary address toggle - only for yamioo agents */}
                    {isYamiooAgent && (
                    <div className="border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Timer className="h-4 w-4 text-amber-500" />
                          <Label htmlFor="isTemporary" className="font-medium">Endereço temporário</Label>
                        </div>
                        <Switch
                          id="isTemporary"
                          checked={isTemporary}
                          onCheckedChange={setIsTemporary}
                        />
                      </div>
                      {isTemporary && (
                        <div className="space-y-2">
                          <Label>Validade</Label>
                          <Select value={temporaryDays} onValueChange={setTemporaryDays}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="30">30 dias</SelectItem>
                              <SelectItem value="60">60 dias</SelectItem>
                              <SelectItem value="90">90 dias</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            ⏳ Este endereço ficará inativo após {temporaryDays} dias se não for verificado e certificado.
                          </p>
                        </div>
                      )}
                    </div>
                    )}
                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label>Localização GPS</Label>
                          {resolvingAdmin && (
                            <span className="text-xs text-muted-foreground animate-pulse">
                              Identificando localização...
                            </span>
                          )}
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={getCurrentLocation} disabled={resolvingAdmin}>
                          <MapPin className="mr-2 h-4 w-4" />
                          Usar Localização Atual
                        </Button>
                      </div>
                      
                      <LocationMap 
                        latitude={geoLat ? parseFloat(geoLat) : undefined}
                        longitude={geoLon ? parseFloat(geoLon) : undefined}
                        onLocationSelect={handleLocationSelect}
                        initialCenter={mapCenter}
                        initialZoom={mapZoom}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="lat">Latitude</Label>
                          <Input
                            id="lat"
                            value={geoLat}
                            onChange={(e) => setGeoLat(e.target.value)}
                            placeholder="e.g., -8.912345"
                            readOnly
                          />
                        </div>
                        <div>
                          <Label htmlFor="lon">Longitude</Label>
                          <Input
                            id="lon"
                            value={geoLon}
                            onChange={(e) => setGeoLon(e.target.value)}
                            placeholder="e.g., 13.123456"
                            readOnly
                          />
                      </div>
                    </div>

                    {/* Property Photo Capture */}
                    <div className="border-t pt-4">
                      <PropertyPhotoCapture
                        onPhotoCapture={handlePhotoCapture}
                        currentPhoto={propertyPhotoUrl || undefined}
                        onRemovePhoto={handleRemovePhoto}
                      />
                    </div>

                    {/* Delivery Channels Section */}
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Package className="h-5 w-5 text-primary" />
                        <Label className="text-base font-semibold">Canais de Entrega</Label>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Adicione pontos de entrega alternativos como caixas postais, lockers ou pontos de recolha.
                      </p>
                      <DeliveryChannels afrolocRecordId={null} />
                    </div>
                  </div>
                  </div>

                  <div className="flex justify-end gap-4 pt-4">
                    <Button type="button" variant="outline" onClick={() => navigate("/identities")} size="lg">
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading} size="lg" className="bg-gradient-primary hover:scale-105 shadow-elegant hover:shadow-glow transition-all duration-300">
                      <Save className="mr-2 h-5 w-5" />
                      {loading ? "Criando..." : "Criar Identidade"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Preview Card - 1 column */}
            <div className="space-y-6">
              <Card className="glass-strong border border-border/50 shadow-premium animate-scale-in sticky top-6">
                <CardHeader>
                  <CardTitle className="text-xl font-display flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-gradient-warm animate-float" style={{ animationDelay: '0.2s' }}>
                      <MapPin className="h-5 w-5 text-white" />
                    </div>
                    Preview do Código
                  </CardTitle>
                  <CardDescription>
                    Visualização do seu AFROLOC
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 border-2 border-dashed border-primary/30">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">SEU AFROLOC:</p>
                    <p className="font-mono text-sm break-all text-foreground/90 leading-relaxed">
                      {generateCodePreview()}
                    </p>
                  </div>

                  {geoLat && geoLon && (
                    <div className="space-y-3 animate-fade-in">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <MapPin className="h-4 w-4 text-primary" />
                        Coordenadas GPS
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl glass border border-border/50">
                          <p className="text-xs text-muted-foreground mb-1">Latitude</p>
                          <p className="font-mono text-sm font-semibold">{geoLat}</p>
                        </div>
                        <div className="p-3 rounded-xl glass border border-border/50">
                          <p className="text-xs text-muted-foreground mb-1">Longitude</p>
                          <p className="font-mono text-sm font-semibold">{geoLon}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border/50">
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                      <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5 animate-pulse-glow" />
                      <div>
                        <p className="text-sm font-medium mb-1">Identificador Único</p>
                        <p className="text-xs text-muted-foreground">
                          Este código será seu endereço digital permanente e verificável
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
    </DashboardLayout>
  );
}
