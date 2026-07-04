import { useEffect, useRef, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { MapPin, Home, Building2, Store, Mountain, Flame, Search, Filter, X, Award, CheckCircle2, Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type AfrolocRecord = Database["public"]["Tables"]["afroloc_records"]["Row"];

interface IdentitiesMapViewProps {
  records: AfrolocRecord[];
}

const getPropertyIcon = (propertyType: string | null) => {
  switch (propertyType) {
    case 'house':
      return 'home';
    case 'apartment':
      return 'building';
    case 'commercial':
      return 'store';
    case 'land':
      return 'mountain';
    default:
      return 'map-pin';
  }
};

const getMarkerColor = (status: string) => {
  switch (status) {
    case 'certified':
      return '#10b981'; // green
    case 'verified':
      return '#3b82f6'; // blue
    default:
      return '#f59e0b'; // orange
  }
};

export default function IdentitiesMapView({ records }: IdentitiesMapViewProps) {
  const { t } = useLanguage();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPropertyType, setFilterPropertyType] = useState<string>('all');
  const [webGLError, setWebGLError] = useState<boolean>(false);
  const navigate = useNavigate();

  // Filter records based on search and filters
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === '' || 
        record.code.toLowerCase().includes(searchLower) ||
        record.level1_name?.toLowerCase().includes(searchLower) ||
        record.level2_name?.toLowerCase().includes(searchLower) ||
        record.level3_name?.toLowerCase().includes(searchLower) ||
        record.level4_name?.toLowerCase().includes(searchLower) ||
        record.street_name?.toLowerCase().includes(searchLower);

      // Status filter
      const matchesStatus = filterStatus === 'all' || record.status === filterStatus;

      // Property type filter
      const matchesPropertyType = filterPropertyType === 'all' || record.property_type === filterPropertyType;

      return matchesSearch && matchesStatus && matchesPropertyType;
    });
  }, [records, searchQuery, filterStatus, filterPropertyType]);

  const hasActiveFilters = searchQuery !== '' || filterStatus !== 'all' || filterPropertyType !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setFilterPropertyType('all');
  };

  // Calculate statistics
  const statistics = useMemo(() => {
    const total = filteredRecords.length;
    const withGPS = filteredRecords.filter(r => r.geo_lat && r.geo_lon).length;
    const gpsPercentage = total > 0 ? (withGPS / total * 100).toFixed(1) : '0';

    // Property type breakdown
    const propertyTypes = filteredRecords.reduce((acc, record) => {
      const type = record.property_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Status breakdown
    const statuses = filteredRecords.reduce((acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      withGPS,
      gpsPercentage,
      propertyTypes,
      statuses
    };
  }, [filteredRecords]);

  useEffect(() => {
    fetchMapboxToken();
  }, []);

  const fetchMapboxToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      if (error) throw error;
      setMapboxToken(data.token);
    } catch (error) {
      console.error('Error fetching Mapbox token:', error);
    }
  };

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || map.current) return;

    // Calculate center point from all records with GPS
    const recordsWithGPS = records.filter(r => r.geo_lat && r.geo_lon);
    
    let center: [number, number] = [13.2344, -8.8383]; // Default to Angola
    let zoom = 6;

    if (recordsWithGPS.length > 0) {
      const avgLat = recordsWithGPS.reduce((sum, r) => sum + Number(r.geo_lat), 0) / recordsWithGPS.length;
      const avgLon = recordsWithGPS.reduce((sum, r) => sum + Number(r.geo_lon), 0) / recordsWithGPS.length;
      center = [avgLon, avgLat];
      zoom = recordsWithGPS.length === 1 ? 15 : 10;
    }

    mapboxgl.accessToken = mapboxToken;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center,
        zoom,
        failIfMajorPerformanceCaveat: false, // Allow rendering even with performance issues
      });
    } catch (error) {
      console.error('Failed to initialize map:', error);
      setWebGLError(true);
      return;
    }

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    // Wait for map to load before adding sources and layers
    map.current.on('load', () => {
      if (!map.current) return;

      // Prepare GeoJSON data for clustering using filtered records
      const geojsonData: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: filteredRecords
          .filter(r => r.geo_lat && r.geo_lon)
          .map(record => ({
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [Number(record.geo_lon), Number(record.geo_lat)]
            },
            properties: {
              id: record.id,
              code: record.code,
              status: record.status,
              propertyType: record.property_type,
              locationName: record.level4_name || record.level3_name || record.level2_name,
              streetName: record.street_name,
              number: record.number,
              color: getMarkerColor(record.status)
            }
          }))
      };

      // Add clustered source
      map.current.addSource('identities', {
        type: 'geojson',
        data: geojsonData,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
      });

      // Add heatmap layer
      map.current.addLayer({
        id: 'identities-heat',
        type: 'heatmap',
        source: 'identities',
        maxzoom: 15,
        paint: {
          // Increase the heatmap weight based on frequency and property
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'point_count'],
            0, 0,
            6, 1
          ],
          // Increase the heatmap color weight by zoom level
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 1,
            15, 3
          ],
          // Color ramp for heatmap
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(33,102,172,0)',
            0.2, 'rgb(103,169,207)',
            0.4, 'rgb(209,229,240)',
            0.6, 'rgb(253,219,199)',
            0.8, 'rgb(239,138,98)',
            1, 'rgb(178,24,43)'
          ],
          // Adjust the heatmap radius by zoom level
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 2,
            15, 20
          ],
          // Transition from heatmap to circle layer by zoom level
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 1,
            15, 0
          ]
        },
        layout: {
          'visibility': 'none'
        }
      });

      // Add cluster circle layer
      map.current.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'identities',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#3b82f6', // blue for small clusters
            5,
            '#f59e0b', // orange for medium clusters
            10,
            '#ef4444'  // red for large clusters
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20,
            5,
            25,
            10,
            30
          ],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#fff'
        }
      });

      // Add cluster count text layer
      map.current.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'identities',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12
        },
        paint: {
          'text-color': '#ffffff'
        }
      });

      // Add individual marker layer
      map.current.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'identities',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 16,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#fff'
        }
      });

      // Add click handler for clusters
      map.current.on('click', 'clusters', (e) => {
        if (!map.current) return;
        const features = map.current.queryRenderedFeatures(e.point, {
          layers: ['clusters']
        });
        const clusterId = features[0]?.properties?.cluster_id;
        if (!clusterId) return;

        const source = map.current.getSource('identities') as mapboxgl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || !map.current) return;

          const coordinates = (features[0].geometry as GeoJSON.Point).coordinates;
          map.current.easeTo({
            center: coordinates as [number, number],
            zoom: zoom
          });
        });
      });

      // Add click handler for individual points
      map.current.on('click', 'unclustered-point', (e) => {
        if (!e.features || !e.features[0]) return;
        const properties = e.features[0].properties;
        if (!properties) return;

        // Create popup
        const popup = new mapboxgl.Popup({ offset: 25 })
          .setLngLat((e.features[0].geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(`
            <div style="padding: 8px; min-width: 200px;">
              <div style="font-weight: 600; font-family: monospace; margin-bottom: 4px; font-size: 12px;">
                ${properties.code}
              </div>
              <div style="color: #666; font-size: 12px; margin-bottom: 8px;">
                ${properties.locationName}
              </div>
              ${properties.streetName ? `<div style="font-size: 11px; color: #888;">
                ${properties.streetName}, ${properties.number}
              </div>` : ''}
              <div style="margin-top: 8px; font-size: 11px;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; background-color: ${properties.color}; color: white;">
                  ${properties.status}
                </span>
                ${properties.propertyType ? `<span style="margin-left: 4px; color: #666;">${properties.propertyType}</span>` : ''}
              </div>
              <button 
                onclick="window.location.href='/identity/${properties.id}'" 
                style="margin-top: 8px; padding: 4px 12px; background-color: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; width: 100%;"
              >
                ${t('mapview_view_details')}
              </button>
            </div>
          `)
          .addTo(map.current);
      });

      // Change cursor on hover
      map.current.on('mouseenter', 'clusters', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'clusters', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });
      map.current.on('mouseenter', 'unclustered-point', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'unclustered-point', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });
    });

    return () => {
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken, filteredRecords, navigate]);

  // Update data when filtered records change
  useEffect(() => {
    if (!map.current || !map.current.getSource('identities')) return;

    const geojsonData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: filteredRecords
        .filter(r => r.geo_lat && r.geo_lon)
        .map(record => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [Number(record.geo_lon), Number(record.geo_lat)]
          },
          properties: {
            id: record.id,
            code: record.code,
            status: record.status,
            propertyType: record.property_type,
            locationName: record.level4_name || record.level3_name || record.level2_name,
            streetName: record.street_name,
            number: record.number,
            color: getMarkerColor(record.status)
          }
        }))
    };

    const source = map.current.getSource('identities') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(geojsonData);
    }
  }, [filteredRecords]);

  // Toggle between heatmap and cluster view
  useEffect(() => {
    if (!map.current) return;

    const layers = ['identities-heat', 'clusters', 'cluster-count', 'unclustered-point'];
    
    layers.forEach(layer => {
      if (map.current?.getLayer(layer)) {
        if (layer === 'identities-heat') {
          map.current.setLayoutProperty(layer, 'visibility', showHeatmap ? 'visible' : 'none');
        } else {
          map.current.setLayoutProperty(layer, 'visibility', showHeatmap ? 'none' : 'visible');
        }
      }
    });
  }, [showHeatmap]);

  if (!mapboxToken) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">{t('mapview_loading_map')}</p>
      </div>
    );
  }

  // Show fallback UI if WebGL is not available
  if (webGLError) {
    return (
      <div className="space-y-4">
        {/* Statistics Panel - same as above */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('mapview_total_identities')}</span>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{statistics.total}</div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('mapview_gps_coverage')}</span>
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold">{statistics.gpsPercentage}%</div>
              <div className="text-xs text-muted-foreground">
                {statistics.withGPS} {t('mapview_with_gps_coordinates')}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('mapview_status')}</span>
                <Award className="h-4 w-4 text-green-500" />
              </div>
              <div className="space-y-1 text-xs">
                {Object.entries(statistics.statuses).map(([status, count]) => (
                  <div key={status} className="flex justify-between">
                    <Badge variant="outline" className="text-xs">{status}</Badge>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('mapview_properties')}</span>
                <Home className="h-4 w-4 text-blue-500" />
              </div>
              <div className="space-y-1 text-xs">
                {Object.entries(statistics.propertyTypes).slice(0, 3).map(([type, count]) => (
                  <div key={type} className="flex justify-between">
                    <span className="capitalize">{type}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* WebGL Error Fallback */}
        <Card className="p-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-muted rounded-full">
                <MapPin className="h-12 w-12 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{t('mapview_visualization_unavailable')}</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {t('mapview_webgl_error_description')}
              </p>
            </div>
            <div className="pt-4">
              <Button 
                variant="outline" 
                onClick={() => navigate('/identities')}
                className="gap-2"
              >
                <Clock className="h-4 w-4" />
                {t('mapview_switch_timeline_view')}
              </Button>
            </div>
          </div>
        </Card>

        {/* List of identities with GPS */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t('mapview_identities_with_gps')} ({statistics.withGPS})
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredRecords.filter(r => r.geo_lat && r.geo_lon).map(record => (
              <div 
                key={record.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/identity/${record.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: getMarkerColor(record.status) }} />
                  <div>
                    <div className="font-mono text-sm font-medium">{record.code}</div>
                    <div className="text-xs text-muted-foreground">
                      {record.level4_name || record.level3_name || record.level2_name}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{record.status}</Badge>
                  {record.property_type && (
                    <Badge variant="secondary" className="text-xs">{record.property_type}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  const recordsWithoutGPS = filteredRecords.filter(r => !r.geo_lat || !r.geo_lon);

  const propertyTypeIcons: Record<string, any> = {
    house: Home,
    apartment: Building2,
    commercial: Store,
    land: Mountain,
    unknown: MapPin,
    other: MapPin
  };

  return (
    <div className="space-y-4">
      {/* Statistics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Identities */}
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('mapview_total_identities')}</span>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{statistics.total}</div>
            {hasActiveFilters && (
              <div className="text-xs text-muted-foreground">
                {t('mapview_of')} {records.length} {t('mapview_total_lower')}
              </div>
            )}
          </div>
        </Card>

        {/* GPS Coverage */}
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('mapview_gps_coverage')}</span>
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{statistics.gpsPercentage}%</div>
            <div className="text-xs text-muted-foreground">
              {statistics.withGPS} {t('mapview_with_gps_coordinates')}
            </div>
          </div>
        </Card>

        {/* Property Types */}
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('mapview_property_types')}</span>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              {Object.entries(statistics.propertyTypes).slice(0, 3).map(([type, count]) => {
                const Icon = propertyTypeIcons[type] || MapPin;
                return (
                  <div key={type} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <Icon className="h-3 w-3" />
                      <span className="capitalize">{type}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {count}
                    </Badge>
                  </div>
                );
              })}
              {Object.keys(statistics.propertyTypes).length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{Object.keys(statistics.propertyTypes).length - 3} {t('mapview_more')}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Status Distribution */}
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('mapview_status')}</span>
              <Award className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              {Object.entries(statistics.statuses).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    {status === 'certified' && <Award className="h-3 w-3 text-primary" />}
                    {status === 'verified' && <CheckCircle2 className="h-3 w-3 text-blue-500" />}
                    {status === 'draft' && <Clock className="h-3 w-3 text-orange-500" />}
                    <span className="capitalize">{status}</span>
                  </div>
                  <Badge 
                    variant={status === 'certified' ? 'default' : status === 'verified' ? 'secondary' : 'outline'}
                    className="text-xs"
                  >
                    {count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Controls */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t('mapview_filter_search')}</span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  {filteredRecords.length} / {records.length}
                </Badge>
              )}
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                {t('mapview_clear')}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('mapview_search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder={t('mapview_all_statuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('mapview_all_statuses')}</SelectItem>
                <SelectItem value="draft">{t('mapview_status_draft')}</SelectItem>
                <SelectItem value="verified">{t('mapview_status_verified')}</SelectItem>
                <SelectItem value="certified">{t('mapview_status_certified')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Property Type Filter */}
            <Select value={filterPropertyType} onValueChange={setFilterPropertyType}>
              <SelectTrigger>
                <SelectValue placeholder={t('mapview_all_property_types')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('mapview_all_property_types')}</SelectItem>
                <SelectItem value="house">{t('mapview_property_house')}</SelectItem>
                <SelectItem value="apartment">{t('mapview_property_apartment')}</SelectItem>
                <SelectItem value="commercial">{t('mapview_property_commercial')}</SelectItem>
                <SelectItem value="land">{t('mapview_property_land')}</SelectItem>
                <SelectItem value="other">{t('mapview_property_other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="relative">
        <div ref={mapContainer} className="w-full h-[600px] rounded-lg shadow-lg" />
        
        {/* View toggle button */}
        <div className="absolute top-4 left-4 z-10">
          <Button
            onClick={() => setShowHeatmap(!showHeatmap)}
            variant={showHeatmap ? "default" : "secondary"}
            size="sm"
            className="shadow-lg"
          >
            <Flame className="h-4 w-4 mr-2" />
            {showHeatmap ? t('mapview_show_markers') : t('mapview_heat_map')}
          </Button>
        </div>

        {/* Results counter */}
        <div className="absolute bottom-4 left-4 z-10">
          <Badge className="shadow-lg">
            {filteredRecords.filter(r => r.geo_lat && r.geo_lon).length} {t('mapview_locations_shown')}
          </Badge>
        </div>
      </div>
      
      {recordsWithoutGPS.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-2">
            {recordsWithoutGPS.length} {recordsWithoutGPS.length === 1 ? t('mapview_identity_singular') : t('mapview_identity_plural')} {t('mapview_without_gps_coordinates')}
          </p>
          <div className="flex flex-wrap gap-2">
            {recordsWithoutGPS.map(record => (
              <button
                key={record.id}
                onClick={() => navigate(`/identity/${record.id}`)}
                className="text-xs bg-background px-3 py-1 rounded-full hover:bg-accent transition-colors"
              >
                {record.code}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }}></div>
          <span>{t('mapview_status_certified')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3b82f6' }}></div>
          <span>{t('mapview_status_verified')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }}></div>
          <span>{t('mapview_status_draft')}</span>
        </div>
      </div>
    </div>
  );
}