/**
 * AFROLOC - African Digital Address Identification System
 * Grid Lifecycle Statistics Component
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Grid3X3, 
  MapPin, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  Building2,
  TreePine
} from 'lucide-react';

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

interface GridLifecycleStatsProps {
  stats: GridStats;
  loading?: boolean;
}

export default function GridLifecycleStats({ stats, loading }: GridLifecycleStatsProps) {
  const allocationRate = stats.totalCells > 0 
    ? Math.round((stats.allocatedCells / stats.totalCells) * 100) 
    : 0;
  
  const approvalRate = stats.allocatedCells > 0
    ? Math.round((stats.approvedCells / stats.allocatedCells) * 100)
    : 0;

  const urbanRatio = stats.totalCells > 0
    ? Math.round((stats.urbanCells / stats.totalCells) * 100)
    : 0;

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-24" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Primary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Células</CardTitle>
            <Grid3X3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCells.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                <Building2 className="h-3 w-3 mr-1" />
                {stats.urbanCells.toLocaleString()} urbanas
              </Badge>
              <Badge variant="outline" className="text-xs">
                <TreePine className="h-3 w-3 mr-1" />
                {stats.ruralCells.toLocaleString()} rurais
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Alocação</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allocationRate}%</div>
            <Progress value={allocationRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {stats.allocatedCells.toLocaleString()} de {stats.totalCells.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Aprovação</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{approvalRate}%</div>
            <Progress value={approvalRate} className="mt-2 [&>div]:bg-green-500" />
            <p className="text-xs text-muted-foreground mt-1">
              {stats.approvedCells.toLocaleString()} aprovadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgProcessingTime}h</div>
            <p className="text-xs text-muted-foreground mt-2">
              Criação → Alocação
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Zonas Urbanas</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.urbanZones}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.urbanAreaKm2.toFixed(1)} km² total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.pendingCells}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Aguardando aprovação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Criadas Hoje</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayCreated}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.weekCreated} esta semana
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Urbano/Rural</CardTitle>
            <Grid3X3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{urbanRatio}%</div>
            <Progress value={urbanRatio} className="mt-2 [&>div]:bg-blue-500" />
            <p className="text-xs text-muted-foreground mt-1">
              Proporção urbana
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
