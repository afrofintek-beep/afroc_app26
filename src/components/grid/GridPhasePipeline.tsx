/**
 * AFROLOC - African Digital Address Identification System
 * Grid Phase Pipeline - Visual lifecycle phase tracker
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Upload, 
  MapPin, 
  Grid3X3, 
  CheckCircle, 
  Users,
  ArrowRight,
  Clock,
  AlertCircle
} from 'lucide-react';

interface PhaseData {
  id: string;
  name: string;
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  avgTime?: string;
  icon: React.ReactNode;
  status: 'healthy' | 'warning' | 'critical';
}

interface GridPhasePipelineProps {
  phases: PhaseData[];
  loading?: boolean;
  onPhaseClick?: (phaseId: string) => void;
}

export default function GridPhasePipeline({ phases, loading, onPhaseClick }: GridPhasePipelineProps) {
  const { t } = useLanguage();
  const statusColors = {
    healthy: 'bg-green-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
  };

  const statusBg = {
    healthy: 'bg-green-50 dark:bg-green-950 border-green-200',
    warning: 'bg-amber-50 dark:bg-amber-950 border-amber-200',
    critical: 'bg-red-50 dark:bg-red-950 border-red-200',
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('phasepipeline_title_short')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex-1 h-24 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid3X3 className="h-5 w-5" />
          {t('phasepipeline_title_lifecycle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-hidden px-3 sm:px-6">
        <div 
          className="flex items-stretch gap-3 overflow-x-auto pb-4 snap-x snap-mandatory touch-pan-x"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
            msOverflowStyle: 'auto'
          }}
        >
          {phases.map((phase, index) => (
            <div 
              key={phase.id} 
              className="flex items-center flex-shrink-0 snap-start"
              style={{ minWidth: '150px', maxWidth: '200px' }}
            >
              <button 
                type="button"
                onClick={() => onPhaseClick?.(phase.id)}
                className={cn(
                  "w-full p-3 sm:p-4 rounded-lg border transition-all hover:shadow-md text-left",
                  "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
                  statusBg[phase.status]
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={cn(
                    "p-2 rounded-lg",
                    phase.status === 'healthy' && 'bg-green-100 dark:bg-green-900',
                    phase.status === 'warning' && 'bg-amber-100 dark:bg-amber-900',
                    phase.status === 'critical' && 'bg-red-100 dark:bg-red-900',
                  )}>
                    {phase.icon}
                  </div>
                  <div className={cn(
                    "h-2 w-2 rounded-full",
                    statusColors[phase.status]
                  )} />
                </div>
                
                <h4 className="font-medium text-sm mb-1">{phase.name}</h4>
                <p className="text-2xl font-bold">{phase.count.toLocaleString()}</p>
                
                <div className="mt-2">
                  <Progress value={phase.percentage} className="h-1" />
                </div>
                
                <div className="flex items-center justify-between mt-2">
                  <Badge variant="secondary" className="text-xs">
                    {phase.percentage}%
                  </Badge>
                  {phase.avgTime && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {phase.avgTime}
                    </span>
                  )}
                </div>
              </button>
              
              {index < phases.length - 1 && (
                <ArrowRight className="h-5 w-5 text-muted-foreground mx-1 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span>{t('phasepipeline_status_healthy')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span>{t('phasepipeline_status_warning')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span>{t('phasepipeline_status_critical')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Default phases for the grid lifecycle
export function getDefaultPhases(data: {
  zoneDetection: number;
  cellCreation: number;
  batchQueue: number;
  allocation: number;
  approved: number;
}): PhaseData[] {
  const total = data.zoneDetection + data.cellCreation + data.batchQueue + data.allocation + data.approved;
  
  return [
    {
      id: 'zone-detection',
      name: 'Deteção de Zona',
      count: data.zoneDetection,
      percentage: total > 0 ? Math.round((data.zoneDetection / total) * 100) : 0,
      trend: 'stable',
      avgTime: '< 1s',
      icon: <MapPin className="h-4 w-4 text-blue-600" />,
      status: 'healthy',
    },
    {
      id: 'cell-creation',
      name: 'Criação de Célula',
      count: data.cellCreation,
      percentage: total > 0 ? Math.round((data.cellCreation / total) * 100) : 0,
      trend: 'up',
      avgTime: '~2s',
      icon: <Grid3X3 className="h-4 w-4 text-purple-600" />,
      status: 'healthy',
    },
    {
      id: 'batch-queue',
      name: 'Fila de Lote',
      count: data.batchQueue,
      percentage: total > 0 ? Math.round((data.batchQueue / total) * 100) : 0,
      trend: 'stable',
      avgTime: '~5min',
      icon: <Upload className="h-4 w-4 text-amber-600" />,
      status: data.batchQueue > 1000 ? 'warning' : 'healthy',
    },
    {
      id: 'allocation',
      name: 'Alocação',
      count: data.allocation,
      percentage: total > 0 ? Math.round((data.allocation / total) * 100) : 0,
      trend: 'up',
      avgTime: '~24h',
      icon: <Users className="h-4 w-4 text-green-600" />,
      status: 'healthy',
    },
    {
      id: 'approved',
      name: 'Aprovado',
      count: data.approved,
      percentage: total > 0 ? Math.round((data.approved / total) * 100) : 0,
      trend: 'up',
      icon: <CheckCircle className="h-4 w-4 text-emerald-600" />,
      status: 'healthy',
    },
  ];
}
