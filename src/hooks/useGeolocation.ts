import { useState, useCallback } from 'react';
import { Geolocation, Position } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';

export interface GPSCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
}

export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [coordinates, setCoordinates] = useState<GPSCoordinates | null>(null);
  const { toast } = useToast();

  const isNative = Capacitor.isNativePlatform();

  const getCurrentPosition = useCallback(async (): Promise<GPSCoordinates | null> => {
    setLoading(true);
    try {
      // Web fallback
      if (!isNative) {
        // Mobile browsers inside an embedded preview (iframe) - warn but still try
        let inIframe = false;
        try {
          inIframe = window.self !== window.top;
        } catch {
          inIframe = true;
        }

        if (inIframe) {
          console.log('[useGeolocation] Running in iframe, attempting geolocation anyway...');
        }

        if (!navigator.geolocation) {
          toast({
            title: 'Geolocalização não suportada',
            description: 'O seu navegador não suporta geolocalização',
            variant: 'destructive',
          });
          return null;
        }

        const gps = await new Promise<GPSCoordinates | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const result: GPSCoordinates = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude || undefined,
                altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
                heading: position.coords.heading || undefined,
                speed: position.coords.speed || undefined,
              };
              resolve(result);
            },
            (error) => {
              console.error('Web geolocation error:', error);
              let message = 'Falha ao obter localização';
              if (error.code === error.PERMISSION_DENIED) {
                message = 'Permissão de localização negada';
              } else if (error.code === error.POSITION_UNAVAILABLE) {
                message = 'Localização indisponível';
              } else if (error.code === error.TIMEOUT) {
                message = 'Tempo limite excedido';
              }
              toast({
                title: 'Erro de Localização',
                description: message,
                variant: 'destructive',
              });
              resolve(null);
            },
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0,
            }
          );
        });

        if (gps) {
          setCoordinates(gps);
          toast({
            title: 'Localização Capturada',
            description: `Precisão: ${gps.accuracy?.toFixed(0)}m`,
          });
        }
        return gps;
      }

      // Native Capacitor path
      const permission = await Geolocation.checkPermissions();
      
      if (permission.location !== 'granted') {
        const requestResult = await Geolocation.requestPermissions();
        if (requestResult.location !== 'granted') {
          throw new Error('Location permission denied');
        }
      }

      // Get position with high accuracy
      const position: Position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

      const gps: GPSCoordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude || undefined,
        altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
        heading: position.coords.heading || undefined,
        speed: position.coords.speed || undefined,
      };

      setCoordinates(gps);
      
      toast({
        title: 'Location Captured',
        description: `Accuracy: ${gps.accuracy?.toFixed(0)}m`,
      });

      return gps;
    } catch (error: any) {
      console.error('Geolocation error:', error);
      toast({
        title: 'Location Error',
        description: error.message || 'Failed to get location',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, isNative]);

  const clearCoordinates = useCallback(() => {
    setCoordinates(null);
  }, []);

  return {
    coordinates,
    loading,
    getCurrentPosition,
    clearCoordinates,
  };
}
