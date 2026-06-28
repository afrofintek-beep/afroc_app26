import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from './ui/button';
import { MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
      setMapError('WebGL não está disponível no seu navegador. Por favor, use um navegador moderno ou habilite WebGL.');
      return;
    }

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
        setMapError('Erro ao carregar o mapa. Por favor, recarregue a página.');
      });

    } catch (error: any) {
      console.error('Error initializing map:', error);
      setMapError(error.message || 'Erro ao inicializar o mapa');
      setWebGLSupported(false);
    }

    // Cleanup
    return () => {
      try {
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
        <p className="text-muted-foreground">Carregando mapa...</p>
      </div>
    );
  }

  if (!mapboxToken) {
    return (
      <div className="w-full h-[400px] bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">Erro ao carregar o mapa</p>
      </div>
    );
  }

  if (mapError || !webGLSupported) {
    return (
      <div className="w-full h-[400px] bg-muted rounded-lg flex flex-col items-center justify-center p-6 space-y-4">
        <div className="text-destructive text-center">
          <p className="font-medium mb-2">Mapa não disponível</p>
          <p className="text-sm text-muted-foreground">{mapError}</p>
        </div>
        <div className="w-full max-w-md space-y-3">
          <p className="text-sm text-center text-muted-foreground">Use sua localização atual:</p>
          <Button 
            onClick={handleCurrentLocation} 
            className="w-full"
            variant="outline"
          >
            <MapPin className="mr-2 h-4 w-4" />
            Usar Localização Atual
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] rounded-lg overflow-hidden border">
      <div ref={mapContainer} className="absolute inset-0" />
      <div className="absolute top-4 left-4 bg-background/95 p-2 rounded-lg shadow-lg text-sm">
        <p className="font-medium">Clique no mapa ou arraste o marcador</p>
        <p className="text-muted-foreground text-xs">para selecionar sua localização</p>
      </div>
    </div>
  );
}