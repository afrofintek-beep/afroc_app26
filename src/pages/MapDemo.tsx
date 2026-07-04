import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, Home, Building, TreePine, ArrowLeft, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import afrolocLogo from '@/assets/afroloc-symbol-gold.png';
import { AddressTypeBadge } from '@/components/AddressTypeBadge';
import { useLanguage } from '@/contexts/LanguageContext';

interface DemoAddress {
  id: string;
  code: string;
  country: string;
  level1_name: string | null;
  level2_name: string | null;
  level3_name: string | null;
  level4_name: string | null;
  street_name: string | null;
  number: string | null;
  property_type: string | null;
  geo_lat: number | null;
  geo_lon: number | null;
  status: string | null;
  address_type: string | null;
}

const propertyTypeIcons: Record<string, typeof Home> = {
  house: Home,
  apartment: Building,
  commercial: Building,
  land: TreePine,
};

const propertyTypeLabelKeys: Record<string, string> = {
  house: 'mapdemo_property_house',
  apartment: 'mapdemo_property_apartment',
  commercial: 'mapdemo_property_commercial',
  land: 'mapdemo_property_land',
};

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  verified: 'bg-primary/20 text-primary',
  certified: 'bg-green-500/20 text-green-600',
};

const statusLabelKeys: Record<string, string> = {
  draft: 'mapdemo_status_draft',
  verified: 'mapdemo_status_verified',
  certified: 'mapdemo_status_certified',
};

// Marker colors by property type
const propertyTypeColors: Record<string, { gradient: string; hex: string }> = {
  house: { gradient: 'linear-gradient(135deg, hsl(45, 93%, 47%) 0%, hsl(36, 100%, 50%) 100%)', hex: '#d97706' },
  apartment: { gradient: 'linear-gradient(135deg, hsl(217, 91%, 60%) 0%, hsl(221, 83%, 53%) 100%)', hex: '#3b82f6' },
  commercial: { gradient: 'linear-gradient(135deg, hsl(142, 71%, 45%) 0%, hsl(142, 76%, 36%) 100%)', hex: '#22c55e' },
  land: { gradient: 'linear-gradient(135deg, hsl(271, 91%, 65%) 0%, hsl(271, 81%, 56%) 100%)', hex: '#a855f7' },
};

export default function MapDemo() {
  const { t } = useLanguage();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<DemoAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<DemoAddress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch Mapbox token
  useEffect(() => {
    async function fetchToken() {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token', {
          body: {}
        });
        
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        }
      } catch (err) {
        console.error('Error fetching Mapbox token:', err);
        setError(t('mapdemo_error_load_map'));
      }
    }
    
    fetchToken();
  }, []);

  // Fetch demo addresses from Luanda via public endpoint
  useEffect(() => {
    async function fetchAddresses() {
      try {
        // Use the public address-gateway endpoint to fetch addresses
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/address-gateway`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'list',
            countryCode: 'AO',
            limit: 50
          })
        });
        
        if (!response.ok) throw new Error('Failed to fetch addresses');
        
        const result = await response.json();
        if (result.success && result.data?.records) {
          setAddresses(result.data.records);
        }
      } catch (err) {
        console.error('Error fetching addresses:', err);
      }
    }
    
    fetchAddresses();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [13.2344, -8.8389], // Luanda center
      zoom: 11,
      pitch: 45,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      'top-right'
    );

    map.current.on('load', () => {
      setLoading(false);
    });

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Add markers for addresses
  useEffect(() => {
    if (!map.current || addresses.length === 0) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    addresses.forEach(address => {
      if (!address.geo_lat || !address.geo_lon) return;

      // Get color based on property type
      const colorConfig = propertyTypeColors[address.property_type || ''] || propertyTypeColors.house;
      
      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'demo-marker';
      el.style.cssText = `
        width: 36px;
        height: 36px;
        background: ${colorConfig.gradient};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        transition: transform 0.2s ease;
        border: 2px solid white;
      `;
      
      const inner = document.createElement('div');
      inner.style.cssText = `
        width: 14px;
        height: 14px;
        background: white;
        border-radius: 50%;
        transform: rotate(45deg);
      `;
      el.appendChild(inner);

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'rotate(-45deg) scale(1.2)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'rotate(-45deg) scale(1)';
      });
      el.addEventListener('click', () => {
        setSelectedAddress(address);
        map.current?.flyTo({
          center: [address.geo_lon!, address.geo_lat!],
          zoom: 15,
          duration: 1000,
        });
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([address.geo_lon, address.geo_lat])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (addresses.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      addresses.forEach(addr => {
        if (addr.geo_lat && addr.geo_lon) {
          bounds.extend([addr.geo_lon, addr.geo_lat]);
        }
      });
      map.current.fitBounds(bounds, { padding: 60, duration: 1000 });
    }
  }, [addresses, map.current]);

  const formatAddress = (addr: DemoAddress) => {
    const parts = [];
    if (addr.street_name && addr.number) {
      parts.push(`${addr.street_name}, Nº ${addr.number}`);
    } else if (addr.street_name) {
      parts.push(addr.street_name);
    }
    if (addr.level4_name) parts.push(addr.level4_name);
    if (addr.level3_name) parts.push(addr.level3_name);
    if (addr.level2_name) parts.push(addr.level2_name);
    return parts.join(', ') || t('mapdemo_address_unspecified');
  };

  const PropertyIcon = selectedAddress?.property_type 
    ? propertyTypeIcons[selectedAddress.property_type] || MapPin 
    : MapPin;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/landing">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t('mapdemo_back')}
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <img src={afrolocLogo} alt="AFROLOC" className="h-8 w-8" />
              <span className="font-bold text-lg">AFROLOC</span>
              <Badge variant="secondary">{t('mapdemo_demo')}</Badge>
            </div>
          </div>
          <Link to="/login">
            <Button size="sm">{t('mapdemo_login')}</Button>
          </Link>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Sidebar */}
        <aside className="w-80 border-r bg-card/50 overflow-y-auto hidden md:block">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {t('mapdemo_addresses_in_luanda')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {addresses.length} {t('mapdemo_addresses_registered_suffix')}
            </p>
          </div>

          <div className="p-2 space-y-2">
            {addresses.map((addr) => {
              const Icon = propertyTypeIcons[addr.property_type || ''] || MapPin;
              const isSelected = selectedAddress?.id === addr.id;
              
              return (
                <Card 
                  key={addr.id}
                  className={`cursor-pointer transition-all hover:bg-accent/50 ${isSelected ? 'ring-2 ring-primary bg-accent' : ''}`}
                  onClick={() => {
                    setSelectedAddress(addr);
                    if (addr.geo_lat && addr.geo_lon) {
                      map.current?.flyTo({
                        center: [addr.geo_lon, addr.geo_lat],
                        zoom: 15,
                        duration: 1000,
                      });
                    }
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs text-primary truncate">
                          {addr.code}
                        </p>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {formatAddress(addr)}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-xs">
                            {propertyTypeLabelKeys[addr.property_type || ''] ? t(propertyTypeLabelKeys[addr.property_type || '']) : t('mapdemo_property_other')}
                          </Badge>
                          <Badge className={`text-xs ${statusColors[addr.status || 'draft']}`}>
                            {t(statusLabelKeys[addr.status || 'draft'])}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {addresses.length === 0 && !loading && (
              <div className="p-8 text-center text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t('mapdemo_no_addresses_found')}</p>
              </div>
            )}
          </div>
        </aside>

        {/* Map Container */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <Card className="max-w-md">
                <CardContent className="p-6 text-center">
                  <Info className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">{error}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div ref={mapContainer} className="absolute inset-0" />

          {/* Selected Address Info Card */}
          {selectedAddress && (
            <Card className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-20 shadow-xl">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-mono text-primary">
                    {selectedAddress.code}
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedAddress(null)}
                  >
                    ✕
                  </Button>
                </div>
                <CardDescription>
                  {formatAddress(selectedAddress)}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t('mapdemo_field_type')}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <PropertyIcon className="h-4 w-4 text-primary" />
                      <span>{propertyTypeLabelKeys[selectedAddress.property_type || ''] ? t(propertyTypeLabelKeys[selectedAddress.property_type || '']) : t('mapdemo_property_other')}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('mapdemo_field_status')}</p>
                    <Badge className={`mt-0.5 ${statusColors[selectedAddress.status || 'draft']}`}>
                      {t(statusLabelKeys[selectedAddress.status || 'draft'])}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('mapdemo_field_latitude')}</p>
                    <p className="font-mono text-xs">{selectedAddress.geo_lat?.toFixed(6)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('mapdemo_field_longitude')}</p>
                    <p className="font-mono text-xs">{selectedAddress.geo_lon?.toFixed(6)}</p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <AddressTypeBadge addressType={selectedAddress.address_type} isCertified={selectedAddress.status === "certified"} size="sm" />
                    <span>• {selectedAddress.level1_name || 'Angola'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Legend */}
          <Card className="absolute top-4 left-4 z-20 hidden md:block">
            <CardContent className="p-3">
              <h3 className="text-sm font-medium mb-2">{t('mapdemo_legend_property_type')}</h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 shadow-sm" />
                  <Home className="h-3 w-3" />
                  <span>{t('mapdemo_property_house')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 shadow-sm" />
                  <Building className="h-3 w-3" />
                  <span>{t('mapdemo_property_apartment')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-green-500 shadow-sm" />
                  <Building className="h-3 w-3" />
                  <span>{t('mapdemo_property_commercial')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-400 to-purple-500 shadow-sm" />
                  <TreePine className="h-3 w-3" />
                  <span>{t('mapdemo_property_land')}</span>
                </div>
              </div>
              <div className="border-t mt-2 pt-2">
                <h3 className="text-sm font-medium mb-1.5">{t('mapdemo_field_status')}</h3>
                <div className="flex flex-wrap gap-1">
                  <Badge className={`text-xs ${statusColors.draft}`}>{t('mapdemo_status_draft')}</Badge>
                  <Badge className={`text-xs ${statusColors.verified}`}>{t('mapdemo_status_verified')}</Badge>
                  <Badge className={`text-xs ${statusColors.certified}`}>{t('mapdemo_status_certified')}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mobile address count */}
          <div className="absolute top-4 right-4 z-20 md:hidden">
            <Badge variant="secondary" className="shadow-lg">
              {addresses.length} {t('mapdemo_addresses_word')}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
