import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from './ui/button';
import { MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface LocationMapProps {
  latitude?: number;
  longitude?: number;
  onLocationSelect: (lat: number, lon: number) => void;
  initialCenter?: [number, number];
  initialZoom?: number;
}

export default function LocationMap({ 
  latitude, 
  longitude, 
  onLocationSelect, 
  initialCenter = [13.2344, -8.8383],
  initialZoom = 6 
}: LocationMapProps) {
  const { t } = useLanguage();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [webGLSupported, setWebGLSupported] = useState(true);

  useEffect(() => {
    // Get Mapbox token from edge function
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchToken();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    // Check WebGL support
    const checkWebGLSupport = () => {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return !!gl;
      } catch (e) {
        return false;
      }
    };

    if (!checkWebGLSupport()) {
      setWebGLSupported(false);
      setMapError(t('locationmap_webgl_unavailable'));
      return;
    }

    // Observador de tamanho — redesenha o mapa quando o contentor muda de
    // dimensão (resolve o mapa "preto" por canvas 0×0 em qualquer timing).
    let resizeObserver: ResizeObserver | null = null;

    // Initialize map with error handling
    try {
      mapboxgl.accessToken = mapboxToken;
      
      const initialLat = latitude || initialCenter[1];
      const initialLon = longitude || initialCenter[0];

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [initialLon, initialLat],
        zoom: initialZoom,
        failIfMajorPerformanceCaveat: false, // Allow map to load even on slower devices
      });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    // Add geolocate control
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    });
    
    map.current.addControl(geolocateControl, 'top-right');

    // O Mapbox pode desenhar um canvas 0×0 (mapa "preto") quando o contentor
    // ainda não tinha tamanho no arranque — forçar resize no load resolve.
    map.current.on('load', () => {
      map.current?.resize();
    });

    // Redesenha sempre que o contentor ganha/altera tamanho.
    resizeObserver = new ResizeObserver(() => map.current?.resize());
    resizeObserver.observe(mapContainer.current);

    // Create marker
    marker.current = new mapboxgl.Marker({
      draggable: true,
      color: '#3b82f6'
    })
      .setLngLat([initialLon, initialLat])
      .addTo(map.current);

    // Update coordinates when marker is dragged
    marker.current.on('dragend', () => {
      if (marker.current) {
        const lngLat = marker.current.getLngLat();
        onLocationSelect(lngLat.lat, lngLat.lng);
      }
    });

    // Update marker position when map is clicked
    map.current.on('click', (e) => {
      if (marker.current) {
        marker.current.setLngLat(e.lngLat);
        onLocationSelect(e.lngLat.lat, e.lngLat.lng);
      }
    });

      // Handle map load errors
      map.current.on('error', (e) => {
        console.error('Mapbox error:', e);
        setMapError(t('locationmap_load_error_reload'));
      });

    } catch (error: any) {
      console.error('Error initializing map:', error);
      setMapError(error.message || t('locationmap_init_error'));
      setWebGLSupported(false);
    }

    // Cleanup
    return () => {
      try {
        resizeObserver?.disconnect();
        map.current?.remove();
      } catch (e) {
        console.error('Error removing map:', e);
      }
    };
  }, [mapboxToken]);

  // Update marker position when props change
  useEffect(() => {
    if (marker.current && latitude && longitude) {
      marker.current.setLngLat([longitude, latitude]);
      map.current?.flyTo({
        center: [longitude, latitude],
        zoom: 15
      });
    }
  }, [latitude, longitude]);

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude: lat, longitude: lon } = position.coords;
          onLocationSelect(lat, lon);
          if (marker.current) {
            marker.current.setLngLat([lon, lat]);
          }
          map.current?.flyTo({
            center: [lon, lat],
            zoom: 16
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  if (loading) {
    return (
      <div className="w-full h-[400px] bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">{t('locationmap_loading')}</p>
      </div>
    );
  }

  if (!mapboxToken) {
    return (
      <div className="w-full h-[400px] bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">{t('locationmap_load_error')}</p>
      </div>
    );
  }

  if (mapError || !webGLSupported) {
    return (
      <div className="w-full h-[400px] bg-muted rounded-lg flex flex-col items-center justify-center p-6 space-y-4">
        <div className="text-destructive text-center">
          <p className="font-medium mb-2">{t('locationmap_map_unavailable')}</p>
          <p className="text-sm text-muted-foreground">{mapError}</p>
        </div>
        <div className="w-full max-w-md space-y-3">
          <p className="text-sm text-center text-muted-foreground">{t('locationmap_use_current_location_prompt')}</p>
          <Button 
            onClick={handleCurrentLocation} 
            className="w-full"
            variant="outline"
          >
            <MapPin className="mr-2 h-4 w-4" />
            {t('locationmap_use_current_location_button')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-lg overflow-hidden border">
      {/* Altura EXPLÍCITA no próprio contentor do mapa. Antes era `absolute inset-0`
          sobre um pai h-[400px] que colapsava para 0 → mapa "preto" (sem tiles). */}
      <div ref={mapContainer} className="w-full h-[400px]" style={{ minHeight: '400px' }} />
      <div className="absolute top-4 left-4 z-10 bg-background/95 p-2 rounded-lg shadow-lg text-sm">
        <p className="font-medium">{t('locationmap_instruction_title')}</p>
        <p className="text-muted-foreground text-xs">{t('locationmap_instruction_subtitle')}</p>
      </div>
    </div>
  );
}