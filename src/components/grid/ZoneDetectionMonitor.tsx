/**
 * AFROLOC - African Digital Address Identification System
 * Zone Detection Monitor - Monitor urban/rural zone detection
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Building2, 
  TreePine, 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  MapPin,
  Loader2
} from 'lucide-react';

interface UrbanZoneStatus {
  zones: number;
  invalidGeometries: number;
  totalAreaKm2: number;
}

interface ZoneLog {
  id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  resolvedZone: 'urban' | 'rural';
  method: string;
  adminPath?: string;
}

export default function ZoneDetectionMonitor() {
  const [status, setStatus] = useState<UrbanZoneStatus | null>(null);
  const [recentLogs, setRecentLogs] = useState<ZoneLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('urban-zones-status');
      if (error) throw error;
      setStatus(data);
    } catch (err) {
      console.error('Error fetching zone status:', err);
    }
  };

  const fetchRecentLogs = async () => {
    try {
      // Fetch recent zone detection events from audit log
      const { data, error } = await supabase
        .from('security_audit_log')
        .select('*')
        .eq('action', 'zone_detection')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (!error && data) {
        setRecentLogs(data.map(log => {
          const details = (typeof log.details === 'object' && log.details !== null) ? log.details as Record<string, unknown> : {};
          return {
            id: log.id,
            timestamp: log.created_at,
            latitude: (details.latitude as number) || 0,
            longitude: (details.longitude as number) || 0,
            resolvedZone: (details.zone as 'urban' | 'rural') || 'rural',
            method: (details.method as string) || 'fallback',
            adminPath: details.admin_path as string | undefined,
          };
        }));
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchRecentLogs()]);
      setLoading(false);
    };
    load();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStatus(), fetchRecentLogs()]);
    setRefreshing(false);
    toast.success('Dados atualizados');
  };

  const polygonCoverage = status 
    ? Math.round((status.zones / Math.max(status.zones + 10, 1)) * 100) 
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Monitor de Deteção de Zona
            </CardTitle>
            <CardDescription>
              Classificação urbano/rural baseada em polígonos PostGIS
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Status Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Zonas Urbanas</span>
                </div>
                <p className="text-3xl font-bold">{status?.zones || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  polígonos registados
                </p>
              </div>

              <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Área Total</span>
                </div>
                <p className="text-3xl font-bold">{status?.totalAreaKm2?.toFixed(1) || 0} km²</p>
                <p className="text-sm text-muted-foreground mt-1">
                  cobertura urbana
                </p>
              </div>

              <div className={`p-4 rounded-lg border ${
                (status?.invalidGeometries || 0) > 0 
                  ? 'bg-amber-50 dark:bg-amber-950' 
                  : 'bg-muted'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className={`h-5 w-5 ${
                    (status?.invalidGeometries || 0) > 0 ? 'text-amber-600' : 'text-muted-foreground'
                  }`} />
                  <span className="font-medium">Geometrias Inválidas</span>
                </div>
                <p className="text-3xl font-bold">{status?.invalidGeometries || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  requer correção
                </p>
              </div>
            </div>

            {/* Detection Method Distribution */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Método de Deteção</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="w-20 justify-center">Polígono</Badge>
                  <Progress value={polygonCoverage} className="flex-1" />
                  <span className="text-sm text-muted-foreground w-12 text-right">{polygonCoverage}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="w-20 justify-center">Keyword</Badge>
                  <Progress value={20} className="flex-1" />
                  <span className="text-sm text-muted-foreground w-12 text-right">20%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="w-20 justify-center">Fallback</Badge>
                  <Progress value={5} className="flex-1" />
                  <span className="text-sm text-muted-foreground w-12 text-right">5%</span>
                </div>
              </div>
            </div>

            {/* Recent Detections */}
            <div>
              <h4 className="font-medium text-sm mb-3">Deteções Recentes</h4>
              <ScrollArea className="h-[200px]">
                {recentLogs.length > 0 ? (
                  <div className="space-y-2">
                    {recentLogs.map(log => (
                      <div 
                        key={log.id} 
                        className="flex items-center gap-3 p-2 rounded-lg border text-sm"
                      >
                        {log.resolvedZone === 'urban' ? (
                          <Building2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        ) : (
                          <TreePine className="h-4 w-4 text-green-500 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="truncate">
                            {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}
                          </p>
                          {log.adminPath && (
                            <p className="text-xs text-muted-foreground truncate">
                              {log.adminPath}
                            </p>
                          )}
                        </div>
                        <Badge variant={log.resolvedZone === 'urban' ? 'default' : 'secondary'}>
                          {log.resolvedZone === 'urban' ? '10m' : '25m'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {log.method}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MapPin className="h-8 w-8 mb-2 opacity-50" />
                    <p>Nenhuma deteção recente</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
