import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { COUNTRIES, getCountryByCode } from "@/utils/countryConfig";
import { 
  Package, 
  Building2, 
  Mail, 
  AlertCircle, 
  Store, 
  FileText, 
  Zap,
  Home,
  ArrowRight,
  ArrowLeft,
  SkipForward,
  MapPin,
  Globe,
  IdCard,
  RefreshCw,
  Loader2,
  Navigation
} from "lucide-react";
import afrolocSymbol from "@/assets/afroloc-symbol-brand.webp";

const purposeOptions = [
  {
    id: "delivery",
    icon: Package,
    titleKey: "purpose_delivery",
    descKey: "purpose_delivery_desc"
  },
  {
    id: "banking",
    icon: Building2,
    titleKey: "purpose_banking",
    descKey: "purpose_banking_desc"
  },
  {
    id: "postal",
    icon: Mail,
    titleKey: "purpose_postal",
    descKey: "purpose_postal_desc"
  },
  {
    id: "emergency",
    icon: AlertCircle,
    titleKey: "purpose_emergency",
    descKey: "purpose_emergency_desc"
  },
  {
    id: "business",
    icon: Store,
    titleKey: "purpose_business",
    descKey: "purpose_business_desc"
  },
  {
    id: "government",
    icon: FileText,
    titleKey: "purpose_government",
    descKey: "purpose_government_desc"
  },
  {
    id: "utilities",
    icon: Zap,
    titleKey: "purpose_utilities",
    descKey: "purpose_utilities_desc"
  },
  {
    id: "property",
    icon: Home,
    titleKey: "purpose_property",
    descKey: "purpose_property_desc"
  },
  {
    id: "identification",
    icon: IdCard,
    titleKey: "purpose_identification",
    descKey: "purpose_identification_desc"
  },
  {
    id: "update_residence",
    icon: RefreshCw,
    titleKey: "purpose_update_residence",
    descKey: "purpose_update_residence_desc"
  }
];

export default function PreSignup() {
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [citySuggestions, setCitySuggestions] = useState<any[]>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, setLanguage } = useLanguage();

  useEffect(() => {
    checkAuth();
  }, []);

  // Auto-change language when country is selected
  useEffect(() => {
    if (selectedCountry) {
      const country = getCountryByCode(selectedCountry);
      if (country) {
        setLanguage(country.language);
      }
    }
  }, [selectedCountry, setLanguage]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      navigate("/dashboard");
    }
  };

  const MAX_SELECTIONS = 3;

  const togglePurpose = (purposeId: string) => {
    setSelectedPurposes(prev => {
      if (prev.includes(purposeId)) {
        return prev.filter(id => id !== purposeId);
      } else if (prev.length < MAX_SELECTIONS) {
        return [...prev, purposeId];
      } else {
        toast({
          title: t("error"),
          description: t("max_selections_reached"),
          variant: "destructive",
        });
        return prev;
      }
    });
  };

  const handleContinue = () => {
    if (!selectedCountry || !city) {
      toast({
        title: t("error"),
        description: t("select_country_first"),
        variant: "destructive",
      });
      return;
    }

    if (selectedPurposes.length === 0) {
      toast({
        title: t("error"),
        description: t("select_at_least_one"),
        variant: "destructive",
      });
      return;
    }

    // Pass data securely through React Router state
    navigate("/signup", {
      state: {
        country: selectedCountry,
        city: city,
        purposes: selectedPurposes
      }
    });
  };

  const handleSkip = () => {
    navigate("/signup", {
      state: {
        country: null,
        city: null,
        purposes: []
      }
    });
  };

  const detectLocation = async () => {
    setIsLoadingLocation(true);
    try {
      // Get user's position
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;

      // Call edge function to get location details
      const { data, error } = await supabase.functions.invoke('get-mapbox-token', {
        body: { latitude, longitude }
      });

      if (error) throw error;

      if (data.location) {
        setCity(data.location.place_name);
        
        // Try to match country
        const countryMatch = COUNTRIES.find(
          c => c.name.toLowerCase() === data.location.country?.toLowerCase()
        );
        if (countryMatch) {
          setSelectedCountry(countryMatch.code);
        }

        toast({
          title: t("location_detected"),
          description: t("location_detected_desc"),
        });
      }
    } catch (error: any) {
      console.error('Geolocation error:', error);
      
      let errorMessage = t("location_error");
      
      // Handle different geolocation error codes
      if (error.code === 1) {
        // PERMISSION_DENIED
        errorMessage = t("location_permission_denied");
      } else if (error.code === 2) {
        // POSITION_UNAVAILABLE - GPS is off or not available
        errorMessage = t("gps_unavailable");
      } else if (error.code === 3) {
        // TIMEOUT
        errorMessage = t("gps_timeout");
      }
      
      toast({
        title: t("error"),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const searchCities = async (query: string) => {
    if (query.length < 2) {
      setCitySuggestions([]);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token', {
        body: { 
          search: query,
          country: selectedCountry 
        }
      });

      if (error) throw error;

      if (data.suggestions) {
        setCitySuggestions(data.suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const handleCityChange = (value: string) => {
    setCity(value);
    searchCities(value);
  };

  const selectSuggestion = (suggestion: any) => {
    setCity(suggestion.place_name);
    setCitySuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="absolute top-4 left-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          title={t('back')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <Card className="w-full max-w-4xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center mb-4">
            <div className="flex flex-col items-center gap-2">
              <img src={afrolocSymbol} alt="AFROLOC" className="h-14 w-14 object-cover rounded-xl shadow-md ring-1 ring-primary/20" />
              <span className="text-lg font-display font-bold text-primary tracking-wide">AFROLOC</span>
            </div>
          </div>
          <CardTitle className="text-3xl">{t("onboarding_title")}</CardTitle>
          <CardDescription className="text-base">
            {t("onboarding_description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information Section */}
          <div className="space-y-4 p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">{t("basic_info")}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t("basic_info_desc")}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">{t("country")}</Label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger id="country">
                    <SelectValue placeholder={t("select_country")} />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {t(country.nameKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">{t("city")}</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => handleCityChange(e.target.value)}
                      onFocus={() => citySuggestions.length > 0 && setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      placeholder={t("city_placeholder")}
                      className="pl-10"
                    />
                    {showSuggestions && citySuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
                        {citySuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => selectSuggestion(suggestion)}
                            className="w-full text-left px-4 py-2 hover:bg-muted transition-colors flex items-start gap-2"
                          >
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{suggestion.place_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={detectLocation}
                    disabled={isLoadingLocation}
                    title={t("detect_location")}
                  >
                    {isLoadingLocation ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Navigation className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Purpose Selection Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t("onboarding_title")}</h3>
              <span className="text-sm text-muted-foreground">
                {selectedPurposes.length} / {MAX_SELECTIONS} {t("selected")}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {purposeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedPurposes.includes(option.id);
              const isDisabled = !isSelected && selectedPurposes.length >= MAX_SELECTIONS;
              
              return (
                <div
                  key={option.id}
                  onClick={() => !isDisabled && togglePurpose(option.id)}
                  className={`
                    relative p-4 rounded-lg border-2 transition-all
                    ${isSelected 
                      ? "border-primary bg-primary/5 cursor-pointer" 
                      : isDisabled
                      ? "border-border bg-muted/30 cursor-not-allowed opacity-60"
                      : "border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer"
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      disabled={isDisabled}
                      onCheckedChange={() => !isDisabled && togglePurpose(option.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-5 w-5 text-primary" />
                        <Label className="font-semibold cursor-pointer">
                          {t(option.titleKey)}
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t(option.descKey)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleSkip}
              className="flex-1"
            >
              <SkipForward className="mr-2 h-4 w-4" />
              {t("skip")}
            </Button>
            <Button
              onClick={handleContinue}
              disabled={selectedPurposes.length === 0 || !selectedCountry || !city}
              className="flex-1"
            >
              {t("continue")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}