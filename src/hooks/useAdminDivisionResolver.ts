import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AdminDivision {
  code: string;
  name: string;
  level: number;
}

interface ResolvedHierarchy {
  level1: AdminDivision | null;
  level2: AdminDivision | null;
  level3: AdminDivision | null;
  level4: AdminDivision | null;
  zone: 'urban' | 'rural';
  gridSize: number;
}

interface MapboxFeature {
  id: string;
  place_type: string[];
  text: string;
  context?: Array<{ id: string; text: string }>;
}

export function useAdminDivisionResolver() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  /**
   * Resolve administrative hierarchy from GPS coordinates
   * Uses Mapbox reverse geocoding + local database matching
   */
  const resolveFromCoordinates = useCallback(async (
    countryCode: string,
    latitude: number,
    longitude: number
  ): Promise<ResolvedHierarchy | null> => {
    setLoading(true);
    
    try {
      // 1. Call resolve-zone to get zone type
      const { data: zoneData, error: zoneError } = await supabase.functions.invoke('resolve-zone', {
        body: { lat: latitude, lon: longitude }
      });

      let zone: 'urban' | 'rural' = 'rural';
      let gridSize = 25;

      if (!zoneError && zoneData) {
        zone = zoneData.zone || 'rural';
        gridSize = zoneData.grid_size_meters || (zone === 'urban' ? 10 : 25);
      }

      // 2. Get Mapbox token and do reverse geocoding
      const { data: mapboxData, error: mapboxError } = await supabase.functions.invoke('get-mapbox-token', {
        body: { latitude, longitude }
      });

      if (mapboxError) {
        console.error('Mapbox error:', mapboxError);
        toast({
          title: "Erro na geocodificação",
          description: "Não foi possível identificar a localização automaticamente",
          variant: "destructive"
        });
        setLoading(false);
        return null;
      }

      // 3. Parse Mapbox response to extract place names
      const features = mapboxData?.features as MapboxFeature[] | undefined;
      const placeNames: string[] = [];

      if (features && features.length > 0) {
        // Extract all place names from feature and context
        for (const feature of features) {
          if (feature.text) {
            placeNames.push(feature.text.toLowerCase());
          }
          if (feature.context) {
            for (const ctx of feature.context) {
              if (ctx.text) {
                placeNames.push(ctx.text.toLowerCase());
              }
            }
          }
        }
      }

      console.log('[AdminResolver] Place names from Mapbox:', placeNames);

      // 4. Query administrative_divisions to find matches
      // Start with provinces (level 1)
      const { data: provinces } = await supabase
        .from('administrative_divisions')
        .select('code, name, level')
        .eq('country_code', countryCode)
        .eq('level', 1);

      let matchedLevel1: AdminDivision | null = null;
      let matchedLevel2: AdminDivision | null = null;
      let matchedLevel3: AdminDivision | null = null;

      // Try to match province
      if (provinces) {
        for (const prov of provinces) {
          const provNameLower = prov.name.toLowerCase();
          if (placeNames.some(p => 
            p.includes(provNameLower) || 
            provNameLower.includes(p) ||
            normalizeAccents(p).includes(normalizeAccents(provNameLower))
          )) {
            matchedLevel1 = prov;
            break;
          }
        }
      }

      // If province found, try to match municipality
      if (matchedLevel1) {
        const { data: municipalities } = await supabase
          .from('administrative_divisions')
          .select('code, name, level')
          .eq('country_code', countryCode)
          .eq('level', 2)
          .eq('parent_code', matchedLevel1.code);

        if (municipalities) {
          for (const mun of municipalities) {
            const munNameLower = mun.name.toLowerCase();
            if (placeNames.some(p => 
              p.includes(munNameLower) || 
              munNameLower.includes(p) ||
              normalizeAccents(p).includes(normalizeAccents(munNameLower))
            )) {
              matchedLevel2 = mun;
              break;
            }
          }
        }

        // If municipality found, try to match commune
        if (matchedLevel2) {
          const { data: communes } = await supabase
            .from('administrative_divisions')
            .select('code, name, level')
            .eq('country_code', countryCode)
            .eq('level', 3)
            .eq('parent_code', matchedLevel2.code);

          if (communes) {
            for (const com of communes) {
              const comNameLower = com.name.toLowerCase();
              if (placeNames.some(p => 
                p.includes(comNameLower) || 
                comNameLower.includes(p) ||
                normalizeAccents(p).includes(normalizeAccents(comNameLower))
              )) {
                matchedLevel3 = com;
                break;
              }
            }
          }
        }
      }

      setLoading(false);

      const result: ResolvedHierarchy = {
        level1: matchedLevel1,
        level2: matchedLevel2,
        level3: matchedLevel3,
        level4: null, // Neighborhood level typically not in Mapbox
        zone,
        gridSize
      };

      console.log('[AdminResolver] Resolved hierarchy:', result);

      return result;

    } catch (error) {
      console.error('[AdminResolver] Error:', error);
      setLoading(false);
      return null;
    }
  }, [toast]);

  return {
    resolveFromCoordinates,
    loading
  };
}

/**
 * Normalize accented characters for matching
 */
function normalizeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
