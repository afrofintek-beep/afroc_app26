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
          title: t('createid_toast_location_identified'),
          description: `${t('createid_zone')}: ${resolved.zone === 'urban' ? t('createid_zone_urban') : t('createid_zone_rural')} (${resolved.gridSize}m) ${resolved.level1?.name || ''} ${resolved.level2?.name ? '> ' + resolved.level2.name : ''}`,
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
    if (!navigator.geolocation) {
      toast({
        title: t('createid_error'),
        description: t('createid_error_location_unavailable'),
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        // Use handleLocationSelect to also resolve admin hierarchy
        await handleLocationSelect(lat, lon);
      },
      (error) => {
        // Mensagem específica por tipo de erro — ajuda o utilizador a resolver
        // (a causa nº1 no Mac é a permissão negada / Serviços de Localização off).
        let description = t('createid_error_location_unavailable');
        if (error.code === error.PERMISSION_DENIED) {
          description = t('createid_geo_permission_denied');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          description = t('createid_geo_unavailable');
        } else if (error.code === error.TIMEOUT) {
          description = t('createid_geo_timeout');
        }
        console.error('Geolocation error:', error.code, error.message);
        toast({
          title: t('createid_error'),
          description,
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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
        title: t('createid_requester_required_title'),
        description: t('createid_requester_required_desc'),
        variant: "destructive",
      });
      return;
    }

    // Property type is REQUIRED
    if (!propertyType) {
      toast({
        title: t('createid_property_type_required_title'),
        description: t('createid_property_type_required_desc'),
        variant: "destructive",
      });
      return;
    }
    
    // For formal addresses (with street name), number is required
    const isDigitalAddress = !streetName;
    const numberRequired = !isDigitalAddress;
    
    if (!country || !level1Code || !level2Code || !geoLat || !geoLon) {
      toast({
        title: t('createid_incomplete_info_title'),
        description: t('createid_incomplete_info_desc'),
        variant: "destructive",
      });
      return;
    }
    
    if (numberRequired && !number) {
      toast({
        title: t('createid_number_required_title'),
        description: t('createid_number_required_desc'),
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
              title: t('createid_location_registered_title'),
              description: t('createid_location_registered_desc'),
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
        }
        
        // For apartments, require unit number to differentiate
        if (isApartmentOrBuilding && !unit) {
          toast({
            title: t('createid_unit_required_title'),
            description: t('createid_unit_required_desc'),
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
              title: t('createid_apartment_registered_title'),
              description: `${t('createid_apartment_registered_desc_prefix')} "${unit}" ${t('createid_apartment_registered_desc_suffix')}`,
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
        title: t('createid_success_title'),
        description: t('createid_success_desc'),
      });
      navigate("/identities");
    } catch (error: any) {
      console.error("Error creating AFROLOC:", error);
      
      // Detailed error handling with user-friendly messages
      let errorTitle = t('createid_error_create_title');
      let errorDescription = "";

      const errorMsg = error.message?.toLowerCase() || '';
      const errorCode = error.code || '';

      if (errorMsg.includes('maximum limit') || errorMsg.includes('afroloc addresses per user')) {
        errorTitle = `⚠️ ${t('createid_error_limit_title')}`;
        errorDescription = t('createid_error_limit_desc');
      } else if (errorMsg.includes('duplicate key') || errorMsg.includes('afroid_records_code_key') || errorCode === '23505') {
        errorTitle = `🔄 ${t('createid_error_duplicate_title')}`;
        errorDescription = t('createid_error_duplicate_desc');
      } else if (errorMsg.includes('not authenticated') || errorMsg.includes('jwt') || errorCode === 'PGRST301') {
        errorTitle = `🔐 ${t('createid_error_session_title')}`;
        errorDescription = t('createid_error_session_desc');
      } else if (errorMsg.includes('permission denied') || errorMsg.includes('rls') || errorCode === '42501') {
        errorTitle = `🚫 ${t('createid_error_permission_title')}`;
        errorDescription = t('createid_error_permission_desc');
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('connection')) {
        errorTitle = `📡 ${t('createid_error_connection_title')}`;
        errorDescription = t('createid_error_connection_desc');
      } else if (errorMsg.includes('timeout')) {
        errorTitle = `⏱️ ${t('createid_error_timeout_title')}`;
        errorDescription = t('createid_error_timeout_desc');
      } else if (errorMsg.includes('invalid') || errorMsg.includes('validation')) {
        errorTitle = `❌ ${t('createid_error_invalid_title')}`;
        errorDescription = t('createid_error_invalid_desc');
      } else if (errorMsg.includes('foreign key') || errorCode === '23503') {
        errorTitle = `📋 ${t('createid_error_reference_title')}`;
        errorDescription = t('createid_error_reference_desc');
      } else {
        // Generic error with technical details for debugging
        errorTitle = `❌ ${t('createid_error_unexpected_title')}`;
        errorDescription = `${t('createid_error_unexpected_desc_prefix')} ${error.message || t('createid_error_unknown')}. ${t('createid_error_unexpected_desc_suffix')}`;
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
            {t('createid_back')}
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
                  {t('createid_hero_title')}
                </h1>
                <p className="text-white/90 text-lg">
                  {t('createid_hero_subtitle')}
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
                {t('createid_address_info')}
              </CardTitle>
              <CardDescription className="text-base">
                {t('createid_address_info_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="country">{t('createid_country')}</Label>
                      <Select value={country} onValueChange={setCountry} required>
                        <SelectTrigger>
                          <SelectValue placeholder={t('createid_country_placeholder')} />
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
                            {t('createid_address_types')}
                          </h4>
                          <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                            {t('createid_address_types_intro')}
                          </p>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-start gap-2">
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex-shrink-0">🏛️ {t('createid_type_formal_label')}</span>
                              <span className="text-blue-700 dark:text-blue-300">
                                {t('createid_type_formal_desc')}
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-amber-600 dark:text-amber-400 font-bold flex-shrink-0">📍 {t('createid_type_informal_label')}</span>
                              <span className="text-blue-700 dark:text-blue-300">
                                {t('createid_type_informal_desc')}
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">🌐 {t('createid_type_digital_label')}</span>
                              <span className="text-blue-700 dark:text-blue-300">
                                {t('createid_type_digital_desc')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="level1">{t('createid_province')} <span className="text-destructive">*</span></Label>
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
                            <SelectValue placeholder={t('createid_province_placeholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            {provinces.map(p => (
                              <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="level2">{t('createid_municipality')} <span className="text-destructive">*</span></Label>
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
                            <SelectValue placeholder={level1Code ? t('createid_municipality_placeholder') : t('createid_municipality_placeholder_disabled')} />
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
                        <Label htmlFor="level3">{t('createid_commune')}</Label>
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
                            <SelectValue placeholder={communes.length === 0 ? t('createid_commune_placeholder_empty') : t('createid_optional')} />
                          </SelectTrigger>
                          <SelectContent>
                            {communes.map(c => (
                              <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="level4">{t('createid_neighborhood')}</Label>
                        <Input
                          id="level4"
                          value={level4Name}
                          onChange={(e) => setLevel4Name(e.target.value)}
                          placeholder={t('createid_optional')}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="street">
                          {t('createid_street_name')}
                          <span className="text-xs text-muted-foreground ml-1">{t('createid_street_name_hint')}</span>
                        </Label>
                        <Input
                          id="street"
                          value={streetName}
                          onChange={(e) => setStreetName(e.target.value)}
                          placeholder={t('createid_street_placeholder')}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('createid_street_help')}
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="number">
                          {t('createid_number')}
                          {streetName && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        {streetName ? (
                          <Input
                            id="number"
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            placeholder={t('createid_number_placeholder')}
                            required
                          />
                        ) : (
                          <div className="space-y-2">
                            <Input
                              id="number"
                              value={number}
                              onChange={(e) => setNumber(e.target.value)}
                              placeholder={t('createid_number_placeholder_assigned')}
                              disabled
                              className="bg-muted"
                            />
                            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                              <p className="text-xs text-amber-800 dark:text-amber-200">
                                <strong>📍 {t('createid_digital_address_label')}</strong> {t('createid_digital_address_note')}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="unit">{t('createid_unit')}</Label>
                        <Input
                          id="unit"
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          placeholder={t('createid_optional')}
                        />
                      </div>
                      <div>
                        <Label htmlFor="propertyName">
                          {t('createid_property_name')}
                          <span className="text-xs text-muted-foreground ml-1">{t('createid_property_name_hint')}</span>
                        </Label>
                        <Input
                          id="propertyName"
                          value={propertyName}
                          onChange={(e) => setPropertyName(e.target.value)}
                          placeholder={t('createid_property_name_placeholder')}
                        />
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          ⚠️ {t('createid_property_name_warning')}
                        </p>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="propertyType">
                        {t('createid_property_type')} <span className="text-destructive">*</span>
                      </Label>
                      <Select value={propertyType} onValueChange={setPropertyType} required>
                        <SelectTrigger className={!propertyType ? "border-amber-500" : ""}>
                          <SelectValue placeholder={t('createid_property_type_placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="house">🏠 {t('createid_property_type_house')}</SelectItem>
                          <SelectItem value="apartment">🏢 {t('createid_property_type_apartment')}</SelectItem>
                          <SelectItem value="commercial">🏪 {t('createid_property_type_commercial')}</SelectItem>
                          <SelectItem value="land">🌍 {t('createid_property_type_land')}</SelectItem>
                          <SelectItem value="other">📍 {t('createid_property_type_other')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {propertyType === 'apartment'
                          ? `💡 ${t('createid_property_type_note_apartment')}`
                          : `⚠️ ${t('createid_property_type_note_single')}`
                        }
                      </p>
                    </div>

                    {/* Temporary address toggle - only for yamioo agents */}
                    {isYamiooAgent && (
                    <div className="border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Timer className="h-4 w-4 text-amber-500" />
                          <Label htmlFor="isTemporary" className="font-medium">{t('createid_temporary_address')}</Label>
                        </div>
                        <Switch
                          id="isTemporary"
                          checked={isTemporary}
                          onCheckedChange={setIsTemporary}
                        />
                      </div>
                      {isTemporary && (
                        <div className="space-y-2">
                          <Label>{t('createid_validity')}</Label>
                          <Select value={temporaryDays} onValueChange={setTemporaryDays}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="30">30 {t('createid_days')}</SelectItem>
                              <SelectItem value="60">60 {t('createid_days')}</SelectItem>
                              <SelectItem value="90">90 {t('createid_days')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            ⏳ {t('createid_temporary_note_prefix')} {temporaryDays} {t('createid_temporary_note_suffix')}
                          </p>
                        </div>
                      )}
                    </div>
                    )}
                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label>{t('createid_gps_location')}</Label>
                          {resolvingAdmin && (
                            <span className="text-xs text-muted-foreground animate-pulse">
                              {t('createid_identifying_location')}
                            </span>
                          )}
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={getCurrentLocation} disabled={resolvingAdmin}>
                          <MapPin className="mr-2 h-4 w-4" />
                          {t('createid_use_current_location')}
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
                          <Label htmlFor="lat">{t('createid_latitude')}</Label>
                          <Input
                            id="lat"
                            value={geoLat}
                            onChange={(e) => setGeoLat(e.target.value)}
                            placeholder="e.g., -8.912345"
                            readOnly
                          />
                        </div>
                        <div>
                          <Label htmlFor="lon">{t('createid_longitude')}</Label>
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
                        <Label className="text-base font-semibold">{t('createid_delivery_channels')}</Label>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t('createid_delivery_channels_desc')}
                      </p>
                      <DeliveryChannels afrolocRecordId={null} />
                    </div>
                  </div>
                  </div>

                  <div className="flex justify-end gap-4 pt-4">
                    <Button type="button" variant="outline" onClick={() => navigate("/identities")} size="lg">
                      {t('createid_cancel')}
                    </Button>
                    <Button type="submit" disabled={loading} size="lg" className="bg-gradient-primary hover:scale-105 shadow-elegant hover:shadow-glow transition-all duration-300">
                      <Save className="mr-2 h-5 w-5" />
                      {loading ? t('createid_creating') : t('createid_create_button')}
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
                    {t('createid_code_preview')}
                  </CardTitle>
                  <CardDescription>
                    {t('createid_code_preview_desc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 border-2 border-dashed border-primary/30">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">{t('createid_your_afroloc')}</p>
                    <p className="font-mono text-sm break-all text-foreground/90 leading-relaxed">
                      {generateCodePreview()}
                    </p>
                  </div>

                  {geoLat && geoLon && (
                    <div className="space-y-3 animate-fade-in">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <MapPin className="h-4 w-4 text-primary" />
                        {t('createid_gps_coordinates')}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl glass border border-border/50">
                          <p className="text-xs text-muted-foreground mb-1">{t('createid_latitude')}</p>
                          <p className="font-mono text-sm font-semibold">{geoLat}</p>
                        </div>
                        <div className="p-3 rounded-xl glass border border-border/50">
                          <p className="text-xs text-muted-foreground mb-1">{t('createid_longitude')}</p>
                          <p className="font-mono text-sm font-semibold">{geoLon}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border/50">
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                      <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5 animate-pulse-glow" />
                      <div>
                        <p className="text-sm font-medium mb-1">{t('createid_unique_identifier')}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('createid_unique_identifier_desc')}
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
