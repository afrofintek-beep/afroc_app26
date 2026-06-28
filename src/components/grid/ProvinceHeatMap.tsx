/**
 * AFROLOC - African Digital Address Identification System
 * Province Heat Map - Visualize grid cell density and allocation rates
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Map, 
  Layers, 
  RefreshCw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  Info
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProvinceData {
  name: string;
  code: string;
  totalCells: number;
  approvedCells: number;
  pendingCells: number;
  rejectedCells: number;
  allocationRate: number;
  coordinates?: [number, number]; // center point
}

interface ProvinceHeatMapProps {
  countryCode: string;
}

// Angola province approximate center coordinates
const PROVINCE_COORDINATES: Record<string, [number, number]> = {
  'LUA': [13.2344, -8.8389],   // Luanda
  'BGO': [13.5500, -9.1000],   // Bengo
  'BGU': [14.9167, -12.5833],  // Benguela
  'BIE': [17.6667, -12.5833],  // Bié
  'CAB': [12.2000, -5.5500],   // Cabinda
  'CNN': [15.0000, -14.6667],  // Cunene
  'HUA': [15.7333, -14.9167],  // Huambo
  'HUI': [13.5000, -14.9167],  // Huíla
  'KWE': [20.0000, -11.0000],  // Cuando Cubango
  'KWN': [18.5000, -7.5000],   // Kwanza Norte
  'KWS': [14.8333, -10.5000],  // Kwanza Sul
  'LNO': [18.0000, -8.5000],   // Lunda Norte
  'LSU': [20.4167, -10.0000],  // Lunda Sul
  'MAL': [16.3333, -9.5000],   // Malanje
  'MOX': [21.5000, -13.5000],  // Moxico
  'NAM': [15.2000, -15.1500],  // Namibe
  'UIG': [15.0500, -7.6000],   // Uíge
  'ZAI': [12.8500, -6.2667],   // Zaire
};

// Country default centers
const COUNTRY_CENTERS: Record<string, { center: [number, number]; zoom: number }> = {
  'AO': { center: [17.5, -12.5], zoom: 5 },
  'MZ': { center: [35.5, -18.5], zoom: 5 },
  'ZA': { center: [25.0, -29.0], zoom: 5 },
  'KE': { center: [37.9, -0.5], zoom: 5.5 },
  'NG': { center: [8.0, 9.0], zoom: 5.5 },
};

export default function ProvinceHeatMap({ countryCode }: ProvinceHeatMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [provinceData, setProvinceData] = useState<ProvinceData[]>([]);
  const [viewMode, setViewMode] = useState<'density' | 'allocation'>('density');
  const [selectedProvince, setSelectedProvince] = useState<ProvinceData | null>(null);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        toast.error('Erro ao carregar o mapa');
      }
    };
    fetchToken();
  }, []);

  // Fetch province data
  const fetchProvinceData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('afroloc_records')
        .select('level1_name, level1_code, status')
        .eq('country', countryCode);

      if (error) throw error;

      // Aggregate by province
      const aggregated: Record<string, ProvinceData> = {};
      
      (data || []).forEach((record: any) => {
        const key = record.level1_code || record.level1_name || 'Unknown';
        const name = record.level1_name || key;
        
        if (!aggregated[key]) {
          aggregated[key] = {
            name,
            code: key,
            totalCells: 0,
            approvedCells: 0,
            pendingCells: 0,
            rejectedCells: 0,
            allocationRate: 0,
            coordinates: PROVINCE_COORDINATES[key],
          };
        }
        
        aggregated[key].totalCells++;
        
        if (record.status === 'approved' || record.status === 'certified') {
          aggregated[key].approvedCells++;
        } else if (record.status === 'pending' || record.status === 'pending_validation') {
          aggregated[key].pendingCells++;
        } else if (record.status === 'rejected') {
          aggregated[key].rejectedCells++;
        }
      });

      // Calculate allocation rates
      Object.values(aggregated).forEach(province => {
        province.allocationRate = province.totalCells > 0
          ? Math.round((province.approvedCells / province.totalCells) * 100)
          : 0;
      });

      setProvinceData(Object.values(aggregated).sort((a, b) => b.totalCells - a.totalCells));
    } catch (err) {
      console.error('Error fetching province data:', err);
    } finally {
      setLoading(false);
    }
  }, [countryCode]);

  useEffect(() => {
    fetchProvinceData();
  }, [fetchProvinceData]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    const countryConfig = COUNTRY_CENTERS[countryCode] || COUNTRY_CENTERS['AO'];
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: countryConfig.center,
      zoom: countryConfig.zoom,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      'top-right'
    );

    map.current.on('load', () => {
      setMapReady(true);
    });

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      popupRef.current?.remove();
      map.current?.remove();
    };
  }, [mapboxToken, countryCode]);

  // Update markers when data or view mode changes
  useEffect(() => {
    if (!map.current || !mapReady || provinceData.length === 0) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Find max values for scaling
    const maxCells = Math.max(...provinceData.map(p => p.totalCells), 1);
    const maxRate = 100;

    provinceData.forEach(province => {
      if (!province.coordinates) return;

      // Calculate marker size and color based on view mode
      let size: number;
      let color: string;
      let value: number;

      if (viewMode === 'density') {
        value = province.totalCells;
        size = Math.max(30, Math.min(80, (value / maxCells) * 80));
        // Color gradient from blue (low) to red (high)
        const intensity = value / maxCells;
        color = getHeatColor(intensity);
      } else {
        value = province.allocationRate;
        size = Math.max(30, Math.min(70, 30 + (province.totalCells / maxCells) * 40));
        // Color gradient from red (low allocation) to green (high allocation)
        const intensity = value / maxRate;
        color = getAllocationColor(intensity);
      }

      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'province-marker';
      el.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: 50%;
        border: 3px solid rgba(255,255,255,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${Math.max(10, size / 4)}px;
        font-weight: bold;
        color: white;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      el.textContent = viewMode === 'density' 
        ? province.totalCells.toString()
        : `${province.allocationRate}%`;

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.15)';
        el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      });

      // Create marker
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(province.coordinates)
        .addTo(map.current!);

      // Add popup on click
      el.addEventListener('click', () => {
        setSelectedProvince(province);
        
        // Create popup content
        const popupContent = `
          <div style="padding: 8px; min-width: 180px;">
            <h3 style="margin: 0 0 8px; font-weight: 600; font-size: 14px;">${province.name}</h3>
            <div style="display: grid; gap: 4px; font-size: 12px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #888;">Total células:</span>
                <strong>${province.totalCells.toLocaleString()}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #888;">Aprovadas:</span>
                <strong style="color: #22c55e;">${province.approvedCells.toLocaleString()}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #888;">Pendentes:</span>
                <strong style="color: #f59e0b;">${province.pendingCells.toLocaleString()}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #888;">Taxa alocação:</span>
                <strong>${province.allocationRate}%</strong>
              </div>
            </div>
          </div>
        `;

        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({ offset: 25, closeButton: true })
          .setLngLat(province.coordinates!)
          .setHTML(popupContent)
          .addTo(map.current!);
      });

      markersRef.current.push(marker);
    });
  }, [mapReady, provinceData, viewMode]);

  const handleZoomIn = () => map.current?.zoomIn();
  const handleZoomOut = () => map.current?.zoomOut();
  const handleResetView = () => {
    const config = COUNTRY_CENTERS[countryCode] || COUNTRY_CENTERS['AO'];
    map.current?.flyTo({ center: config.center, zoom: config.zoom });
  };

  // Helper functions for colors
  function getHeatColor(intensity: number): string {
    // Blue -> Yellow -> Orange -> Red
    if (intensity < 0.25) {
      return `hsl(220, 80%, ${70 - intensity * 80}%)`;
    } else if (intensity < 0.5) {
      return `hsl(${220 - (intensity - 0.25) * 400}, 80%, 50%)`;
    } else if (intensity < 0.75) {
      return `hsl(${120 - (intensity - 0.5) * 240}, 80%, 50%)`;
    } else {
      return `hsl(${60 - (intensity - 0.75) * 240}, 85%, 50%)`;
    }
  }

  function getAllocationColor(rate: number): string {
    // Red -> Yellow -> Green
    if (rate < 0.5) {
      return `hsl(${rate * 60}, 75%, 50%)`;
    } else {
      return `hsl(${30 + rate * 90}, 70%, 45%)`;
    }
  }

  // Calculate totals
  const totals = provinceData.reduce(
    (acc, p) => ({
      cells: acc.cells + p.totalCells,
      approved: acc.approved + p.approvedCells,
      pending: acc.pending + p.pendingCells,
    }),
    { cells: 0, approved: 0, pending: 0 }
  );

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Map className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Mapa de Calor Provincial</CardTitle>
              <CardDescription className="text-xs">
                Densidade e taxas de alocação por região
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'density' | 'allocation')}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <Layers className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="density">Densidade</SelectItem>
                <SelectItem value="allocation">Taxa Alocação</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fetchProvinceData()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Map Container */}
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
              <Skeleton className="h-[400px] w-full" />
            </div>
          )}
          <div 
            ref={mapContainer} 
            className="h-[400px] w-full rounded-b-lg"
            style={{ minHeight: '400px' }}
          />
          
          {/* Map Controls */}
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Ampliar</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Reduzir</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" size="icon" className="h-8 w-8" onClick={handleResetView}>
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Vista geral</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg p-3 border shadow-lg">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium">
              <Info className="h-3 w-3" />
              {viewMode === 'density' ? 'Densidade de Células' : 'Taxa de Alocação'}
            </div>
            <div className="flex items-center gap-1">
              {viewMode === 'density' ? (
                <>
                  <div className="w-4 h-4 rounded-full" style={{ background: getHeatColor(0.1) }} />
                  <div className="w-4 h-4 rounded-full" style={{ background: getHeatColor(0.35) }} />
                  <div className="w-4 h-4 rounded-full" style={{ background: getHeatColor(0.6) }} />
                  <div className="w-4 h-4 rounded-full" style={{ background: getHeatColor(0.85) }} />
                  <span className="text-xs text-muted-foreground ml-1">Baixo → Alto</span>
                </>
              ) : (
                <>
                  <div className="w-4 h-4 rounded-full" style={{ background: getAllocationColor(0.1) }} />
                  <div className="w-4 h-4 rounded-full" style={{ background: getAllocationColor(0.4) }} />
                  <div className="w-4 h-4 rounded-full" style={{ background: getAllocationColor(0.7) }} />
                  <div className="w-4 h-4 rounded-full" style={{ background: getAllocationColor(1) }} />
                  <span className="text-xs text-muted-foreground ml-1">0% → 100%</span>
                </>
              )}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="absolute top-3 right-12 bg-background/90 backdrop-blur-sm rounded-lg p-3 border shadow-lg">
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Províncias:</span>
                <Badge variant="secondary">{provinceData.length}</Badge>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Total células:</span>
                <Badge variant="outline">{totals.cells.toLocaleString()}</Badge>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Aprovadas:</span>
                <Badge className="bg-primary/20 text-primary">{totals.approved.toLocaleString()}</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Province List */}
        <div className="p-4 border-t">
          <h4 className="text-sm font-medium mb-3">Ranking Provincial</h4>
          <div className="grid gap-2 max-h-[200px] overflow-y-auto">
            {provinceData.slice(0, 10).map((province, index) => (
              <div 
                key={province.code}
                className={`flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer ${
                  selectedProvince?.code === province.code 
                    ? 'bg-primary/10 border border-primary/20' 
                    : 'bg-muted/50 hover:bg-muted'
                }`}
                onClick={() => {
                  setSelectedProvince(province);
                  if (province.coordinates && map.current) {
                    map.current.flyTo({ center: province.coordinates, zoom: 7 });
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground w-5">
                    #{index + 1}
                  </span>
                  <span className="text-sm font-medium">{province.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {province.totalCells} células
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      province.allocationRate >= 70 
                        ? 'text-primary border-primary/30' 
                        : province.allocationRate >= 40 
                          ? 'text-secondary-foreground' 
                          : 'text-destructive border-destructive/30'
                    }`}
                  >
                    {province.allocationRate}%
                  </Badge>
                </div>
              </div>
            ))}
            {provinceData.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum dado disponível para este país
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
