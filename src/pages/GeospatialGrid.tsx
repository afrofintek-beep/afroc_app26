import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import QGSQGridMap from '@/components/QGSQGridMap';
import GridCellCreator from '@/components/GridCellCreator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Grid3X3, Map, Info, ArrowLeft, ChevronDown, Plus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Database } from '@/integrations/supabase/types';
import { QGResult } from '@/hooks/useQGSQEngine';

type AfrolocRecord = Database["public"]["Tables"]["afroloc_records"]["Row"];

export default function GeospatialGrid() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [records, setRecords] = useState<AfrolocRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState('AO');
  const [showCreator, setShowCreator] = useState(false);
  const [mapBounds, setMapBounds] = useState<{ minLat: number; maxLat: number; minLon: number; maxLon: number } | undefined>();

  // Country centers for initial map view
  const countryCenters: Record<string, [number, number]> = {
    'AO': [13.2344, -8.8383], // Angola - Luanda
    'MZ': [32.585, -25.966], // Mozambique - Maputo
    'ZA': [28.045, -26.204], // South Africa - Johannesburg
    'KE': [36.817, -1.286], // Kenya - Nairobi
    'NG': [3.379, 6.524], // Nigeria - Lagos
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchRecords = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('afroloc_records')
          .select('*')
          .eq('country', selectedCountry)
          .not('geo_lat', 'is', null)
          .not('geo_lon', 'is', null)
          .limit(500);

        if (error) throw error;
        setRecords(data || []);
      } catch (err) {
        console.error('Error fetching records:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [user, navigate, selectedCountry]);

  // Handle cells generated from creator
  const handleCellsGenerated = useCallback((cells: QGResult[]) => {
    console.log('Generated cells:', cells.length);
    // Could add these to a visual overlay on the map
  }, []);

  // Handle single cell selected
  const handleCellSelected = useCallback((cell: QGResult) => {
    console.log('Selected cell:', cell.afroloc);
    // Could fly to this cell on the map
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Grid3X3 className="h-6 w-6 text-primary" />
                {t('geogrid_title')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('geogrid_subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={showCreator ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowCreator(!showCreator)}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('geogrid_create_cells')}
            </Button>
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('geogrid_select_country')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AO">🇦🇴 Angola</SelectItem>
                <SelectItem value="MZ">🇲🇿 Mozambique</SelectItem>
                <SelectItem value="ZA">🇿🇦 South Africa</SelectItem>
                <SelectItem value="KE">🇰🇪 Kenya</SelectItem>
                <SelectItem value="NG">🇳🇬 Nigeria</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Grid Cell Creator - Collapsible */}
        <Collapsible open={showCreator} onOpenChange={setShowCreator}>
          <CollapsibleContent>
            <GridCellCreator
              countryCode={selectedCountry}
              onCellsGenerated={handleCellsGenerated}
              onCellSelected={handleCellSelected}
              mapBounds={mapBounds}
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Grid3X3 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold">{t('geogrid_qg_engine')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('geogrid_qg_desc')}
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary">{t('geogrid_urban_badge')}</Badge>
                  <Badge variant="secondary">{t('geogrid_rural_badge')}</Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Map className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold">{t('geogrid_sq_engine')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('geogrid_sq_desc')}
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">2×2</Badge>
                  <Badge variant="outline">3×3</Badge>
                  <Badge variant="outline">4×4</Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Info className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold">{t('geogrid_persistence')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('geogrid_persistence_desc')}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Map Component */}
        <QGSQGridMap
          records={records}
          initialCenter={countryCenters[selectedCountry] || countryCenters['AO']}
          initialZoom={19}
          countryCode={selectedCountry}
        />
      </div>
    </DashboardLayout>
  );
}
