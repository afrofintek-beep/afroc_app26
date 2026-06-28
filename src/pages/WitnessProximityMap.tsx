import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MapPin, Users, CheckCircle, XCircle, AlertTriangle, ArrowLeft, Ruler, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useQuery } from '@tanstack/react-query';

interface AfrolocWithWitnesses {
  id: string;
  code: string;
  geo_lat: number | null;
  geo_lon: number | null;
  street_name: string | null;
  number: string | null;
  level1_name: string | null;
  level2_name: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  witnesses: {
    id: string;
    witness_afro_id: string;
    status: string;
    witness_reputation_score: number;
    witness_name: string | null;
    witness_lat: number | null;
    witness_lon: number | null;
  }[];
}

// Haversine formula for distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-600',
  confirmed: 'bg-green-500/20 text-green-600',
  rejected: 'bg-red-500/20 text-red-600',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  rejected: 'Rejeitado',
};

export default function WitnessProximityMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const circleLayerAdded = useRef(false);
  
  const [loading, setLoading] = useState(true);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [selectedAfroloc, setSelectedAfroloc] = useState<AfrolocWithWitnesses | null>(null);
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
        setError('Erro ao carregar o mapa');
      }
    }
    
    fetchToken();
  }, []);

  // Fetch Afrolocs with witnesses
  const { data: afrolocs, isLoading: afrolocsLoading } = useQuery({
    queryKey: ['afrolocs-with-witnesses'],
    queryFn: async () => {
      // Fetch afroloc records with GPS
      const { data: records, error: recordsError } = await supabase
        .from('afroloc_records')
        .select('id, code, geo_lat, geo_lon, street_name, number, level1_name, level2_name, status, metadata')
        .not('geo_lat', 'is', null)
        .not('geo_lon', 'is', null)
        .limit(50);

      if (recordsError) throw recordsError;

      // Fetch witnesses for these records
      const recordIds = records?.map(r => r.id) || [];
      
      const { data: witnesses, error: witnessesError } = await supabase
        .from('afroloc_witnesses')
        .select(`
          id,
          afroloc_record_id,
          witness_afro_id,
          status,
          witness_reputation_score
        `)
        .in('afroloc_record_id', recordIds);

      if (witnessesError) throw witnessesError;

      // Get witness profiles for names
      const witnessUserIds = witnesses?.map(w => w.witness_afro_id) || [];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('afro_id, full_name')
        .in('afro_id', witnessUserIds);

      const profileMap = new Map(profiles?.map(p => [p.afro_id, p.full_name]) || []);

      // Combine data
      const result: AfrolocWithWitnesses[] = records?.map(record => {
        const recordWitnesses = witnesses?.filter(w => w.afroloc_record_id === record.id) || [];
        
        return {
          ...record,
          metadata: record.metadata as Record<string, unknown> | null,
          witnesses: recordWitnesses.map(w => ({
            id: w.id,
            witness_afro_id: w.witness_afro_id,
            status: w.status || 'pending',
            witness_reputation_score: w.witness_reputation_score || 50,
            witness_name: profileMap.get(w.witness_afro_id) || null,
            // For demo, simulate witness locations near the property
            witness_lat: record.geo_lat ? record.geo_lat + (Math.random() - 0.5) * 0.002 : null,
            witness_lon: record.geo_lon ? record.geo_lon + (Math.random() - 0.5) * 0.002 : null,
          }))
        };
      }) || [];

      return result.filter(r => r.witnesses.length > 0);
    }
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [13.2344, -8.8389],
      zoom: 12,
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

  // Update map when selecting an Afroloc
  useEffect(() => {
    if (!map.current || !selectedAfroloc || !selectedAfroloc.geo_lat || !selectedAfroloc.geo_lon) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Remove existing circle layer
    if (map.current.getLayer('proximity-circle')) {
      map.current.removeLayer('proximity-circle');
    }
    if (map.current.getSource('proximity-circle')) {
      map.current.removeSource('proximity-circle');
    }

    const propertyLat = selectedAfroloc.geo_lat;
    const propertyLon = selectedAfroloc.geo_lon;
    const isUrban = (selectedAfroloc.metadata as Record<string, unknown>)?.cellType === 'urban';
    const threshold = isUrban ? 100 : 500;

    // Add 100m radius circle
    map.current.addSource('proximity-circle', {
      type: 'geojson',
      data: createCircleGeoJSON(propertyLon, propertyLat, threshold)
    });

    map.current.addLayer({
      id: 'proximity-circle',
      type: 'fill',
      source: 'proximity-circle',
      paint: {
        'fill-color': '#22c55e',
        'fill-opacity': 0.15,
        'fill-outline-color': '#22c55e'
      }
    });

    // Add property marker (gold)
    const propertyEl = document.createElement('div');
    propertyEl.innerHTML = `
      <div style="
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(245, 158, 11, 0.5);
        border: 3px solid white;
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M12 2L2 9h3v11h14V9h3L12 2z"/>
        </svg>
      </div>
    `;

    const propertyMarker = new mapboxgl.Marker({ element: propertyEl })
      .setLngLat([propertyLon, propertyLat])
      .setPopup(new mapboxgl.Popup().setHTML(`
        <div style="padding: 8px;">
          <strong>Propriedade</strong><br/>
          <code style="font-size: 11px;">${selectedAfroloc.code}</code><br/>
          <span style="color: #22c55e;">Raio: ${threshold}m</span>
        </div>
      `))
      .addTo(map.current);
    
    markersRef.current.push(propertyMarker);

    // Add witness markers
    selectedAfroloc.witnesses.forEach((witness, index) => {
      if (!witness.witness_lat || !witness.witness_lon) return;

      const distance = calculateDistance(
        propertyLat, propertyLon,
        witness.witness_lat, witness.witness_lon
      );
      
      const isWithinRange = distance <= threshold;
      const color = isWithinRange ? '#22c55e' : '#ef4444';

      const witnessEl = document.createElement('div');
      witnessEl.innerHTML = `
        <div style="
          width: 36px;
          height: 36px;
          background: ${color};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px ${isWithinRange ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'};
          border: 2px solid white;
          position: relative;
        ">
          <span style="color: white; font-weight: bold; font-size: 14px;">${index + 1}</span>
        </div>
      `;

      const witnessMarker = new mapboxgl.Marker({ element: witnessEl })
        .setLngLat([witness.witness_lon, witness.witness_lat])
        .setPopup(new mapboxgl.Popup().setHTML(`
          <div style="padding: 8px;">
            <strong>Testemunha ${index + 1}</strong><br/>
            <span style="font-size: 12px;">${witness.witness_name || witness.witness_afro_id}</span><br/>
            <span style="color: ${color};">
              Distância: ${Math.round(distance)}m
              ${isWithinRange ? '✓' : '✗'}
            </span><br/>
            <span style="font-size: 11px;">Reputação: ${witness.witness_reputation_score}</span>
          </div>
        `))
        .addTo(map.current!);

      markersRef.current.push(witnessMarker);
    });

    // Fly to the property
    map.current.flyTo({
      center: [propertyLon, propertyLat],
      zoom: 16,
      duration: 1000,
    });

  }, [selectedAfroloc]);

  // Create GeoJSON circle
  function createCircleGeoJSON(lon: number, lat: number, radiusMeters: number) {
    const points = 64;
    const coords: [number, number][] = [];
    
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const dx = radiusMeters * Math.cos(angle);
      const dy = radiusMeters * Math.sin(angle);
      
      const dLon = dx / (111320 * Math.cos(lat * Math.PI / 180));
      const dLat = dy / 110540;
      
      coords.push([lon + dLon, lat + dLat]);
    }
    coords.push(coords[0]); // Close the polygon

    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [coords]
      },
      properties: {}
    };
  }

  const getProximityStats = (afroloc: AfrolocWithWitnesses) => {
    if (!afroloc.geo_lat || !afroloc.geo_lon) return { within: 0, outside: 0, total: 0 };
    
    const isUrban = (afroloc.metadata as Record<string, unknown>)?.cellType === 'urban';
    const threshold = isUrban ? 100 : 500;
    
    let within = 0;
    let outside = 0;
    
    afroloc.witnesses.forEach(w => {
      if (!w.witness_lat || !w.witness_lon) return;
      const distance = calculateDistance(afroloc.geo_lat!, afroloc.geo_lon!, w.witness_lat, w.witness_lon);
      if (distance <= threshold) within++;
      else outside++;
    });

    return { within, outside, total: afroloc.witnesses.length };
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <aside className="w-96 border-r bg-card/50 overflow-y-auto hidden lg:block">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Ruler className="h-5 w-5 text-primary" />
              Proximidade Testemunhas
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Validação de distância máxima de 100m (urbano) / 500m (rural)
            </p>
          </div>

          <div className="p-4 border-b bg-muted/30">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500" />
                <span>Dentro do raio</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500" />
                <span>Fora do raio</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-500" />
                <span>Propriedade</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500/20 border border-green-500" />
                <span>Zona válida</span>
              </div>
            </div>
          </div>

          <div className="p-2 space-y-2">
            {afrolocsLoading && (
              <div className="p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              </div>
            )}

            {afrolocs?.map((afroloc) => {
              const stats = getProximityStats(afroloc);
              const isSelected = selectedAfroloc?.id === afroloc.id;
              const allValid = stats.outside === 0 && stats.total > 0;
              
              return (
                <Card 
                  key={afroloc.id}
                  className={`cursor-pointer transition-all hover:bg-accent/50 ${isSelected ? 'ring-2 ring-primary bg-accent' : ''}`}
                  onClick={() => setSelectedAfroloc(afroloc)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs text-primary truncate">
                          {afroloc.code}
                        </p>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {afroloc.street_name ? `${afroloc.street_name}, ${afroloc.number || ''}` : afroloc.level2_name || 'Endereço'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs gap-1">
                            <Users className="h-3 w-3" />
                            {afroloc.witnesses.length}
                          </Badge>
                          {allValid ? (
                            <Badge className="text-xs bg-green-500/20 text-green-600 gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Válido
                            </Badge>
                          ) : stats.outside > 0 ? (
                            <Badge className="text-xs bg-red-500/20 text-red-600 gap-1">
                              <XCircle className="h-3 w-3" />
                              {stats.outside} fora
                            </Badge>
                          ) : (
                            <Badge className="text-xs bg-yellow-500/20 text-yellow-600 gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Sem GPS
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {!afrolocsLoading && (!afrolocs || afrolocs.length === 0) && (
              <div className="p-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum Afroloc com testemunhas encontrado</p>
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
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">{error}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div ref={mapContainer} className="absolute inset-0" />

          {/* Selected Afroloc Details */}
          {selectedAfroloc && (
            <Card className="absolute bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-[420px] z-20 shadow-xl">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-mono text-primary">
                    {selectedAfroloc.code}
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedAfroloc(null)}
                  >
                    ✕
                  </Button>
                </div>
                <CardDescription>
                  {selectedAfroloc.street_name ? `${selectedAfroloc.street_name}, ${selectedAfroloc.number || ''}` : 'Endereço não especificado'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Testemunhas ({selectedAfroloc.witnesses.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedAfroloc.witnesses.map((witness, index) => {
                      const distance = witness.witness_lat && witness.witness_lon && selectedAfroloc.geo_lat && selectedAfroloc.geo_lon
                        ? calculateDistance(selectedAfroloc.geo_lat, selectedAfroloc.geo_lon, witness.witness_lat, witness.witness_lon)
                        : null;
                      
                      const isUrban = (selectedAfroloc.metadata as Record<string, unknown>)?.cellType === 'urban';
                      const threshold = isUrban ? 100 : 500;
                      const isWithinRange = distance !== null && distance <= threshold;

                      return (
                        <div 
                          key={witness.id}
                          className={`flex items-center justify-between p-2 rounded-lg ${isWithinRange ? 'bg-green-500/10' : 'bg-red-500/10'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${isWithinRange ? 'bg-green-500' : 'bg-red-500'}`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {witness.witness_name || witness.witness_afro_id}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Reputação: {witness.witness_reputation_score}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-mono ${isWithinRange ? 'text-green-600' : 'text-red-600'}`}>
                              {distance !== null ? `${Math.round(distance)}m` : 'N/A'}
                            </p>
                            <Badge className={statusColors[witness.status]}>
                              {statusLabels[witness.status]}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="pt-3 border-t flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Raio de validação: {(selectedAfroloc.metadata as Record<string, unknown>)?.cellType === 'urban' ? '100m (urbano)' : '500m (rural)'}
                  </span>
                  <div className="flex gap-2">
                    <Badge className="bg-green-500/20 text-green-600">
                      {getProximityStats(selectedAfroloc).within} válidos
                    </Badge>
                    {getProximityStats(selectedAfroloc).outside > 0 && (
                      <Badge className="bg-red-500/20 text-red-600">
                        {getProximityStats(selectedAfroloc).outside} inválidos
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions when no selection */}
          {!selectedAfroloc && !loading && (
            <Card className="absolute top-4 left-4 z-20 max-w-sm">
              <CardContent className="p-4">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Visualização de Proximidade
                </h3>
                <p className="text-sm text-muted-foreground">
                  Selecione um Afroloc na barra lateral para visualizar a localização 
                  das testemunhas e verificar se estão dentro do raio de 100m (urbano) 
                  ou 500m (rural).
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
