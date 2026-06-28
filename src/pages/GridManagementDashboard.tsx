/**
 * AFROLOC - African Digital Address Identification System
 * Grid Management Dashboard - Comprehensive admin interface for grid lifecycle
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Grid3X3, 
  ArrowLeft, 
  MapPin, 
  Layers, 
  Activity,
  Settings,
  Download,
  RefreshCw,
  FileUp,
  Map
} from 'lucide-react';

// Import grid components
import GridLifecycleStats from '@/components/grid/GridLifecycleStats';
import GridPhasePipeline, { getDefaultPhases } from '@/components/grid/GridPhasePipeline';
import ZoneDetectionMonitor from '@/components/grid/ZoneDetectionMonitor';
import BatchOperationsPanel from '@/components/grid/BatchOperationsPanel';
import AllocationStatusTable from '@/components/grid/AllocationStatusTable';
import GridRealtimeFeed from '@/components/grid/GridRealtimeFeed';
import ProvinceHeatMap from '@/components/grid/ProvinceHeatMap';
import { useGridRealtime, GridRealtimeEvent } from '@/hooks/useGridRealtime';

interface GridStats {
  totalCells: number;
  urbanCells: number;
  ruralCells: number;
  allocatedCells: number;
  pendingCells: number;
  approvedCells: number;
  rejectedCells: number;
  urbanZones: number;
  urbanAreaKm2: number;
  avgProcessingTime: number;
  todayCreated: number;
  weekCreated: number;
}

export default function GridManagementDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [selectedCountry, setSelectedCountry] = useState('AO');
  const [stats, setStats] = useState<GridStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allocationTableKey, setAllocationTableKey] = useState(0);

  // Real-time updates hook
  const handleRealtimeEvent = useCallback((event: GridRealtimeEvent) => {
    // Show toast for new events
    if (event.type === 'INSERT') {
      toast.info(`Nova célula criada: ${event.payload.afroloc_code || 'N/A'}`, {
        duration: 3000,
      });
    } else if (event.type === 'UPDATE' && event.payload.new_status === 'approved') {
      toast.success(`Célula aprovada: ${event.payload.afroloc_code || 'N/A'}`, {
        duration: 3000,
      });
    }
    
    // Trigger stats refresh on events
    fetchStats();
    // Refresh allocation table
    setAllocationTableKey(prev => prev + 1);
  }, []);

  const { events, isConnected, lastEventTime, clearEvents } = useGridRealtime({
    countryCode: selectedCountry,
    onEvent: handleRealtimeEvent,
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchStats();
  }, [user, navigate, selectedCountry]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch basic record stats
      const { data: records, error: recordsError } = await supabase
        .from('afroloc_records')
        .select('id, status, metadata, created_at')
        .eq('country', selectedCountry);

      if (recordsError) throw recordsError;

      // Fetch urban zones status
      const { data: zonesData } = await supabase.functions.invoke('urban-zones-status');

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const getZone = (meta: unknown) => (typeof meta === 'object' && meta !== null) ? (meta as Record<string, unknown>).zone : null;
      const urbanCells = records?.filter(r => getZone(r.metadata) === 'urban').length || 0;
      const ruralCells = records?.filter(r => getZone(r.metadata) !== 'urban').length || 0;

      setStats({
        totalCells: records?.length || 0,
        urbanCells,
        ruralCells,
        allocatedCells: records?.filter(r => r.status === 'approved' || r.status === 'certified').length || 0,
        pendingCells: records?.filter(r => r.status === 'pending').length || 0,
        approvedCells: records?.filter(r => r.status === 'approved').length || 0,
        rejectedCells: records?.filter(r => r.status === 'rejected').length || 0,
        urbanZones: zonesData?.zones || 0,
        urbanAreaKm2: zonesData?.totalAreaKm2 || 0,
        avgProcessingTime: 24, // Mock - would calculate from actual data
        todayCreated: records?.filter(r => new Date(r.created_at) >= todayStart).length || 0,
        weekCreated: records?.filter(r => new Date(r.created_at) >= weekStart).length || 0,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
    toast.success('Dados atualizados');
  };

  const phaseData = stats ? getDefaultPhases({
    zoneDetection: stats.totalCells,
    cellCreation: stats.totalCells,
    batchQueue: stats.pendingCells,
    allocation: stats.allocatedCells,
    approved: stats.approvedCells,
  }) : [];

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
                Gestão de Grid
              </h1>
              <p className="text-sm text-muted-foreground">
                Dashboard completo do ciclo de vida do sistema de grelha
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/admin/import-urban-zones')}
            >
              <FileUp className="h-4 w-4 mr-2" />
              Importar Zonas
            </Button>
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Selecionar país" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AO">🇦🇴 Angola</SelectItem>
                <SelectItem value="MZ">🇲🇿 Moçambique</SelectItem>
                <SelectItem value="ZA">🇿🇦 África do Sul</SelectItem>
                <SelectItem value="KE">🇰🇪 Quénia</SelectItem>
                <SelectItem value="NG">🇳🇬 Nigéria</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Overview */}
        <GridLifecycleStats stats={stats || {
          totalCells: 0,
          urbanCells: 0,
          ruralCells: 0,
          allocatedCells: 0,
          pendingCells: 0,
          approvedCells: 0,
          rejectedCells: 0,
          urbanZones: 0,
          urbanAreaKm2: 0,
          avgProcessingTime: 0,
          todayCreated: 0,
          weekCreated: 0,
        }} loading={loading} />

        {/* Phase Pipeline + Realtime Feed */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <GridPhasePipeline phases={phaseData} loading={loading} />
          </div>
          <div className="lg:col-span-1">
            <GridRealtimeFeed 
              events={events}
              isConnected={isConnected}
              lastEventTime={lastEventTime}
              onClear={clearEvents}
            />
          </div>
        </div>

        {/* Tabs for different management areas */}
        <Tabs defaultValue="heatmap">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="heatmap" className="flex items-center gap-2">
              <Map className="h-4 w-4" />
              Mapa de Calor
            </TabsTrigger>
            <TabsTrigger value="zones" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Deteção de Zona
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Operações em Lote
            </TabsTrigger>
            <TabsTrigger value="allocation" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Estado de Alocação
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="heatmap" className="mt-6">
            <ProvinceHeatMap countryCode={selectedCountry} />
          </TabsContent>

          <TabsContent value="zones" className="mt-6">
            <ZoneDetectionMonitor />
          </TabsContent>

          <TabsContent value="batch" className="mt-6">
            <BatchOperationsPanel countryCode={selectedCountry} />
          </TabsContent>

          <TabsContent value="allocation" className="mt-6">
            <AllocationStatusTable key={allocationTableKey} countryCode={selectedCountry} />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configurações do Grid
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <h3 className="font-medium">Tamanhos de Célula</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between p-3 rounded-lg bg-muted">
                        <span>Célula Urbana (ZU)</span>
                        <span className="font-mono">10m × 10m</span>
                      </div>
                      <div className="flex justify-between p-3 rounded-lg bg-muted">
                        <span>Célula Rural (ZR)</span>
                        <span className="font-mono">25m × 25m</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium">Subdivisões (SQ)</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between p-3 rounded-lg bg-muted">
                        <span>Baixa densidade</span>
                        <span className="font-mono">2×2</span>
                      </div>
                      <div className="flex justify-between p-3 rounded-lg bg-muted">
                        <span>Média densidade</span>
                        <span className="font-mono">3×3</span>
                      </div>
                      <div className="flex justify-between p-3 rounded-lg bg-muted">
                        <span>Alta densidade</span>
                        <span className="font-mono">4×4</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="font-medium mb-4">Ações de Manutenção</h3>
                  <div className="flex gap-2">
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Exportar Configuração
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => navigate('/geospatial-grid')}
                    >
                      <Grid3X3 className="h-4 w-4 mr-2" />
                      Visualizar Grid
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
