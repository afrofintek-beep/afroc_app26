import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import { useLanguage } from '@/contexts/LanguageContext';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Grid3X3, MapPin, Radio, Info, Signal, Wifi, Thermometer, TrendingUp, GitCompare, X, Plus, Search, Copy, Check, Navigation, Square, Download, Layers, Satellite, Map as MapIcon, Shield, Lock } from 'lucide-react';
import { useQGSQEngine, QGResult, SQResult, GridCell } from '@/hooks/useQGSQEngine';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, Legend } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO } from 'date-fns';
import { useAuthorizationLevel, LEVEL_NAMES, hasMinimumLevel } from '@/hooks/useAuthorizationLevel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClickProposalModal } from '@/components/ClickProposalModal';

// Minimum authorization level required for cadastral pre-registration
const MIN_LEVEL_CADASTRAL_PREREGISTER = 4; // Certified level - Admin Provincial/Nacional

type AfrolocRecord = Database["public"]["Tables"]["afroloc_records"]["Row"];

// Colors for comparison charts
const COMPARISON_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

interface QGSQGridMapProps {
  records?: AfrolocRecord[];
  initialCenter?: [number, number];
  initialZoom?: number;
  countryCode?: string;
}

// Simulated cell tower data structure
interface CellTower {
  id: string;
  name: string;
  operator: string;
  lat: number;
  lon: number;
  type: '4G' | '3G' | '2G';
  coverageRadius: number; // meters
  signalStrength: 'excellent' | 'good' | 'fair' | 'poor';
  rsrp?: number;
  cellId: string;
}

// Density color scale (cold to hot)
const DENSITY_COLORS = {
  cold: { fill: 'rgba(59, 130, 246, 0.25)', stroke: '#3b82f6' },      // Blue - no records
  cool: { fill: 'rgba(34, 197, 94, 0.35)', stroke: '#22c55e' },       // Green - low density
  warm: { fill: 'rgba(251, 191, 36, 0.45)', stroke: '#f59e0b' },      // Yellow/Amber - medium density
  hot: { fill: 'rgba(249, 115, 22, 0.55)', stroke: '#f97316' },       // Orange - high density
  veryHot: { fill: 'rgba(239, 68, 68, 0.65)', stroke: '#ef4444' },    // Red - very high density
};

// Colors for grid visualization
const GRID_COLORS = {
  urban: {
    fill: 'rgba(59, 130, 246, 0.15)',
    stroke: '#3b82f6',
  },
  rural: {
    fill: 'rgba(34, 197, 94, 0.15)',
    stroke: '#22c55e',
  },
  sq: {
    fill: 'rgba(249, 115, 22, 0.2)',
    stroke: '#f97316',
  },
  selected: {
    fill: 'rgba(168, 85, 247, 0.25)',
    stroke: '#a855f7',
  },
  tower: {
    '4G': { fill: 'rgba(139, 92, 246, 0.2)', stroke: '#8b5cf6', marker: '#7c3aed' },
    '3G': { fill: 'rgba(236, 72, 153, 0.2)', stroke: '#ec4899', marker: '#db2777' },
    '2G': { fill: 'rgba(245, 158, 11, 0.2)', stroke: '#f59e0b', marker: '#d97706' },
  }
};

// Calculate density color based on count and max
function getDensityColor(count: number, maxCount: number): { fill: string; stroke: string; level: string } {
  if (count === 0) return { ...DENSITY_COLORS.cold, level: 'none' };
  
  const ratio = count / Math.max(maxCount, 1);
  
  if (ratio <= 0.2) return { ...DENSITY_COLORS.cool, level: 'low' };
  if (ratio <= 0.4) return { ...DENSITY_COLORS.warm, level: 'medium' };
  if (ratio <= 0.7) return { ...DENSITY_COLORS.hot, level: 'high' };
  return { ...DENSITY_COLORS.veryHot, level: 'very-high' };
}

// Generate simulated cell towers for a country
function generateSimulatedTowers(countryCode: string, bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }): CellTower[] {
  const operators: Record<string, string[]> = {
    'AO': ['Unitel', 'Movicel', 'Africell'],
    'MZ': ['Vodacom', 'Movitel', 'Tmcel'],
    'ZA': ['Vodacom', 'MTN', 'Cell C', 'Telkom'],
    'KE': ['Safaricom', 'Airtel', 'Telkom Kenya'],
    'NG': ['MTN', 'Airtel', 'Glo', '9mobile'],
  };

  const countryOperators = operators[countryCode] || ['Operator 1', 'Operator 2'];
  const towers: CellTower[] = [];
  
  // Generate towers in a grid pattern within bounds
  const latRange = bounds.maxLat - bounds.minLat;
  const lonRange = bounds.maxLon - bounds.minLon;
  
  // Number of towers based on area (roughly 1 tower per 5km² in urban, 1 per 50km² in rural)
  const areaKm2 = latRange * 111 * lonRange * 111 * Math.cos(((bounds.minLat + bounds.maxLat) / 2) * Math.PI / 180);
  const numTowers = Math.min(50, Math.max(5, Math.floor(areaKm2 / 10)));
  
  for (let i = 0; i < numTowers; i++) {
    // Add some randomness to tower positions
    const lat = bounds.minLat + Math.random() * latRange;
    const lon = bounds.minLon + Math.random() * lonRange;
    
    const operator = countryOperators[Math.floor(Math.random() * countryOperators.length)];
    const types: Array<'4G' | '3G' | '2G'> = ['4G', '3G', '2G'];
    const type = types[Math.floor(Math.random() * (Math.random() > 0.6 ? 1 : 3))]; // More 4G towers
    const signals: Array<'excellent' | 'good' | 'fair' | 'poor'> = ['excellent', 'good', 'fair', 'poor'];
    const signalStrength = signals[Math.floor(Math.random() * signals.length)];
    
    // Coverage radius varies by type
    const baseRadius = type === '4G' ? 1500 : type === '3G' ? 2500 : 5000;
    const coverageRadius = baseRadius + Math.random() * baseRadius * 0.5;
    
    // RSRP simulation (-140 to -44 dBm)
    const rsrpBase = signalStrength === 'excellent' ? -60 : signalStrength === 'good' ? -80 : signalStrength === 'fair' ? -100 : -120;
    
    towers.push({
      id: `tower-${countryCode}-${i}`,
      name: `${operator} ${type} Tower ${i + 1}`,
      operator,
      lat,
      lon,
      type,
      coverageRadius,
      signalStrength,
      rsrp: rsrpBase + Math.random() * 10 - 5,
      cellId: `${countryCode}${Math.floor(Math.random() * 1000000).toString(16).toUpperCase()}`,
    });
  }
  
  return towers;
}

// Generate coverage polygon (circle approximation)
function generateCoveragePolygon(lat: number, lon: number, radiusMeters: number, segments: number = 32): number[][] {
  const coords: number[][] = [];
  const radiusDegrees = radiusMeters / 111320; // Approximate conversion
  
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    const dx = radiusDegrees * Math.cos(angle);
    const dy = radiusDegrees * Math.sin(angle) / Math.cos(lat * Math.PI / 180);
    coords.push([lon + dy, lat + dx]);
  }
  
  return coords;
}

// Time-series density trend chart component
function CellDensityTrendChart({ records, cellCode }: { records: AfrolocRecord[]; cellCode: string }) {
  const { t } = useLanguage();
  // Generate monthly trend data from records
  const trendData = useMemo(() => {
    const now = new Date();
    const startDate = subMonths(now, 11); // Last 12 months
    
    // Get all months in the range
    const months = eachMonthOfInterval({
      start: startOfMonth(startDate),
      end: endOfMonth(now)
    });
    
    // Count certifications per month
    const monthlyData = months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const count = records.filter(record => {
        if (!record.created_at) return false;
        const recordDate = parseISO(record.created_at);
        return recordDate >= monthStart && recordDate <= monthEnd;
      }).length;
      
      // Calculate cumulative total
      const cumulativeCount = records.filter(record => {
        if (!record.created_at) return false;
        const recordDate = parseISO(record.created_at);
        return recordDate <= monthEnd;
      }).length;
      
      return {
        month: format(month, 'MMM yy'),
        count,
        cumulative: cumulativeCount,
      };
    });
    
    return monthlyData;
  }, [records]);

  // Calculate trend metrics
  const trendMetrics = useMemo(() => {
    if (trendData.length < 2) return { growth: 0, avgMonthly: 0, peak: 0 };
    
    const totalNew = trendData.reduce((sum, d) => sum + d.count, 0);
    const avgMonthly = totalNew / trendData.length;
    const peak = Math.max(...trendData.map(d => d.count));
    
    // Calculate month-over-month growth for last 3 months
    const recentMonths = trendData.slice(-3);
    const prevMonths = trendData.slice(-6, -3);
    const recentSum = recentMonths.reduce((sum, d) => sum + d.count, 0);
    const prevSum = prevMonths.reduce((sum, d) => sum + d.count, 0);
    const growth = prevSum > 0 ? ((recentSum - prevSum) / prevSum) * 100 : 0;
    
    return { growth, avgMonthly, peak };
  }, [trendData]);

  if (records.length === 0) {
    return (
      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center gap-2 text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm">{t('qgmap_no_cert_data_trend')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4" />
          {t('qgmap_cert_trend_12mo')}
        </h4>
        <div className="flex gap-2">
          <Badge variant={trendMetrics.growth > 0 ? 'default' : trendMetrics.growth < 0 ? 'destructive' : 'secondary'}>
            {trendMetrics.growth > 0 ? '+' : ''}{trendMetrics.growth.toFixed(1)}% {t('qgmap_growth')}
          </Badge>
        </div>
      </div>
      
      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-2 bg-muted/50 rounded">
          <p className="text-xs text-muted-foreground">{t('qgmap_avg_month')}</p>
          <p className="text-lg font-semibold">{trendMetrics.avgMonthly.toFixed(1)}</p>
        </div>
        <div className="text-center p-2 bg-muted/50 rounded">
          <p className="text-xs text-muted-foreground">{t('qgmap_peak_month')}</p>
          <p className="text-lg font-semibold">{trendMetrics.peak}</p>
        </div>
        <div className="text-center p-2 bg-muted/50 rounded">
          <p className="text-xs text-muted-foreground">{t('qgmap_total')}</p>
          <p className="text-lg font-semibold">{records.length}</p>
        </div>
      </div>
      
      {/* Area chart */}
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 10 }} 
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tick={{ fontSize: 10 }} 
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
              axisLine={false}
            />
            <RechartsTooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              labelStyle={{ fontWeight: 'bold' }}
            />
            <Area 
              type="monotone" 
              dataKey="count"
              name={t('qgmap_new_certifications')}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorCount)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Bar chart for monthly comparison */}
      <div className="h-[120px] w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 9 }} 
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tick={{ fontSize: 9 }} 
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
              axisLine={false}
            />
            <RechartsTooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            <Bar 
              dataKey="count"
              name={t('qgmap_monthly')}
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              opacity={0.8}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Cell Comparison Panel Component
interface CellComparisonPanelProps {
  comparisonCells: Array<{ cell: GridCell; color: string }>;
  cellDensity: Map<string, { count: number; records: AfrolocRecord[] }>;
  onRemoveCell: (qgCode: string) => void;
  onClearAll: () => void;
}

function CellComparisonPanel({ comparisonCells, cellDensity, onRemoveCell, onClearAll }: CellComparisonPanelProps) {
  const { t } = useLanguage();
  // Generate combined trend data for all cells
  const combinedTrendData = useMemo(() => {
    const now = new Date();
    const startDate = subMonths(now, 11);
    
    const months = eachMonthOfInterval({
      start: startOfMonth(startDate),
      end: endOfMonth(now)
    });

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const dataPoint: Record<string, number | string> = {
        month: format(month, 'MMM yy'),
      };
      
      comparisonCells.forEach(({ cell }) => {
        const code = cell.qg.afroloc || cell.qg.qgCode || '';
        const records = cellDensity.get(code)?.records || [];
        const count = records.filter(record => {
          if (!record.created_at) return false;
          const recordDate = parseISO(record.created_at);
          return recordDate >= monthStart && recordDate <= monthEnd;
        }).length;
        
        dataPoint[code] = count;
      });
      
      return dataPoint;
    });
  }, [comparisonCells, cellDensity]);

  // Calculate summary metrics for each cell
  const cellMetrics = useMemo(() => {
    return comparisonCells.map(({ cell, color }) => {
      const code = cell.qg.afroloc || cell.qg.qgCode || '';
      const density = cellDensity.get(code);
      const records = density?.records || [];
      const total = records.length;
      
      // Calculate recent activity (last 3 months)
      const now = new Date();
      const threeMonthsAgo = subMonths(now, 3);
      const recentCount = records.filter(r => {
        if (!r.created_at) return false;
        return parseISO(r.created_at) >= threeMonthsAgo;
      }).length;
      
      // Calculate average monthly
      const avgMonthly = total / 12;
      
      // Format short code from new format
      const codeParts = code.split('-');
      const shortCode = codeParts.length >= 5 
        ? `${codeParts[3]}-${codeParts[4]}` 
        : codeParts.slice(-1)[0]?.substring(0, 8) || '';
      
      return {
        qgCode: code,
        shortCode,
        cellType: cell.qg.zone || cell.qg.cellType,
        color,
        total,
        recentCount,
        avgMonthly,
      };
    });
  }, [comparisonCells, cellDensity]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <GitCompare className="h-4 w-4" />
          {t('qgmap_cell_comparison')} ({comparisonCells.length} {t('qgmap_cells')})
        </h3>
        <Button variant="outline" size="sm" onClick={onClearAll}>
          <X className="h-3 w-3 mr-1" />
          {t('qgmap_clear_all')}
        </Button>
      </div>

      {/* Selected cells badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {cellMetrics.map(metric => (
          <Badge
            key={metric.qgCode}
            variant="outline"
            className="flex items-center gap-1 pr-1"
            style={{ borderColor: metric.color, color: metric.color }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: metric.color }} />
            {metric.shortCode}
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 ml-1 hover:bg-destructive/20"
              onClick={() => onRemoveCell(metric.qgCode)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>

      {/* Summary metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        {cellMetrics.map(metric => (
          <div
            key={metric.qgCode}
            className="p-3 rounded-lg border"
            style={{ borderColor: metric.color + '40', backgroundColor: metric.color + '10' }}
          >
            <div className="flex items-center gap-1 mb-2">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: metric.color }} />
              <span className="text-xs font-mono truncate">{metric.shortCode}</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('qgmap_total')}:</span>
                <span className="font-semibold">{metric.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('qgmap_recent_3mo')}:</span>
                <span className="font-semibold">{metric.recentCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('qgmap_avg_mo')}:</span>
                <span className="font-semibold">{metric.avgMonthly.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('qgmap_type')}:</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {metric.cellType}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Combined trend chart */}
      <div className="mt-4">
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          {t('qgmap_trend_comparison_12mo')}
        </h4>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={combinedTrendData} margin={{ top: 5, right: 30, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 10 }} 
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10 }} 
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
              />
              <RechartsTooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend 
                formatter={(value) => {
                  const metric = cellMetrics.find(m => m.qgCode === value);
                  return metric?.shortCode || value;
                }}
              />
              {comparisonCells.map(({ cell, color }) => {
                const code = cell.qg.afroloc || cell.qg.qgCode || '';
                return (
                  <Line
                    key={code}
                    type="monotone"
                    dataKey={code}
                    name={code}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ fill: color, strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stacked area chart for cumulative view */}
      <div className="mt-4">
        <h4 className="text-sm font-medium mb-2">{t('qgmap_cumulative_distribution')}</h4>
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={combinedTrendData} margin={{ top: 5, right: 30, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 9 }} 
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 9 }} 
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
              />
              <RechartsTooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              {comparisonCells.map(({ cell, color }) => {
                const code = cell.qg.afroloc || cell.qg.qgCode || '';
                const shortName = code.split('-').slice(-2).join('-');
                return (
                  <Area
                    key={code}
                    type="monotone"
                    dataKey={code}
                    name={shortName}
                    stackId="1"
                    stroke={color}
                    fill={color}
                    fillOpacity={0.4}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

export default function QGSQGridMap({
  records = [], 
  initialCenter = [13.2344, -8.8383], 
  initialZoom = 10,
  countryCode = 'AO'
}: QGSQGridMapProps) {
  const { t } = useLanguage();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [webGLError, setWebGLError] = useState(false);
  const [showQGGrid, setShowQGGrid] = useState(true);
  const [showSQGrid, setShowSQGrid] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showTowers, setShowTowers] = useState(true);
  const [showCoverage, setShowCoverage] = useState(true);
  const [showDensity, setShowDensity] = useState(true);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonCells, setComparisonCells] = useState<Array<{ cell: GridCell; color: string }>>([]);
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);
  const [selectedTower, setSelectedTower] = useState<CellTower | null>(null);
  const [gridCells, setGridCells] = useState<QGResult[]>([]);
  const [sqCells, setSqCells] = useState<Map<string, SQResult>>(new Map());
  const [towers, setTowers] = useState<CellTower[]>([]);
  const [isGeneratingGrid, setIsGeneratingGrid] = useState(false);
  const [decodeInput, setDecodeInput] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // New states for batch generation and satellite view
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const [batchSelectionMode, setBatchSelectionMode] = useState(false);
  const [batchCodes, setBatchCodes] = useState<QGResult[]>([]);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  
  // Pulsing marker for decoded location
  const pulsingMarkerRef = useRef<mapboxgl.Marker | null>(null);
  
  // Highlighted cell code (for decode/search results)
  const [highlightedCellCode, setHighlightedCellCode] = useState<string | null>(null);
  
  // Panel visibility states (auto-hide on click)
  const [showLegendPanel, setShowLegendPanel] = useState(true);
  const [showStatsPanel, setShowStatsPanel] = useState(true);
  
  // State for click-to-create AFROLOC proposal
  const [clickProposal, setClickProposal] = useState<{
    lat: number;
    lon: number;
    qgResult: QGResult | null;
    isLoading: boolean;
  } | null>(null);

  // Refs to access current values in event handlers
  const gridCellsRef = useRef<QGResult[]>([]);
  const towersRef = useRef<CellTower[]>([]);
  const comparisonModeRef = useRef(false);
  const generateGridForBoundsRef = useRef<((bounds: mapboxgl.LngLatBounds) => Promise<void>) | null>(null);
  const computeFullGridRef = useRef<typeof computeFullGrid | null>(null);
  const addCellToComparisonRef = useRef<((cell: GridCell) => void) | null>(null);

  // Keep refs in sync with state
  useEffect(() => { gridCellsRef.current = gridCells; }, [gridCells]);
  useEffect(() => { towersRef.current = towers; }, [towers]);
  useEffect(() => { comparisonModeRef.current = comparisonMode; }, [comparisonMode]);

  // Add cell to comparison
  const addCellToComparison = useCallback((cell: GridCell) => {
    if (comparisonCells.length >= 5) return;
    const code = cell.qg.afroloc || cell.qg.qgCode || '';
    if (comparisonCells.some(c => (c.cell.qg.afroloc || c.cell.qg.qgCode) === code)) return;
    
    const color = COMPARISON_COLORS[comparisonCells.length];
    setComparisonCells(prev => [...prev, { cell, color }]);
  }, [comparisonCells]);

  // Remove cell from comparison
  const removeCellFromComparison = useCallback((qgCode: string) => {
    setComparisonCells(prev => {
      const filtered = prev.filter(c => (c.cell.qg.afroloc || c.cell.qg.qgCode) !== qgCode);
      return filtered.map((c, i) => ({ ...c, color: COMPARISON_COLORS[i] }));
    });
  }, []);

  // Clear all comparison cells
  const clearComparison = useCallback(() => {
    setComparisonCells([]);
  }, []);
  
  const { loading, computeQG, decodeQG, computeSQ, computeFullGrid } = useQGSQEngine();

  // Copy AFROLOC code to clipboard
  const copyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(t('qgmap_toast_code_copied'));
    setTimeout(() => setCopiedCode(null), 2000);
  }, []);

  // Decode AFROLOC code and navigate to location with pulsing marker
  const handleDecode = useCallback(async () => {
    if (!decodeInput.trim()) return;
    
    setIsDecoding(true);
    console.log('[handleDecode] Starting decode for:', decodeInput.trim());
    
    try {
      const result = await decodeQG(decodeInput.trim());
      console.log('[handleDecode] Decode result:', result);
      
      if (result && map.current) {
        // IMEDIATAMENTE adicionar a célula descodificada ao gridCells para garantir que aparece
        const cellCode = result.afroloc || result.qgCode || '';
        setGridCells(prev => {
          // Verificar se já existe
          const exists = prev.some(c => (c.afroloc || c.qgCode) === cellCode);
          if (exists) return prev;
          // Adicionar a célula descodificada
          return [...prev, result];
        });
        
        // Remove existing pulsing marker if any
        if (pulsingMarkerRef.current) {
          pulsingMarkerRef.current.remove();
          pulsingMarkerRef.current = null;
        }
        
        console.log('[handleDecode] Creating marker at:', result.centroid);
        
        // Create pulsing marker element (wrapper preserves Mapbox transforms)
        const markerEl = document.createElement('div');
        markerEl.className = 'map-marker-wrapper';
        markerEl.innerHTML = '<div class="map-marker-pulse"><div class="map-marker-inner"></div></div>';
        
        // Create and add the marker
        pulsingMarkerRef.current = new mapboxgl.Marker({ element: markerEl })
          .setLngLat([result.centroid.lon, result.centroid.lat])
          .addTo(map.current);
        
        console.log('[handleDecode] Marker added');
        
        // Set highlighted cell code ANTES de fazer zoom
        setHighlightedCellCode(cellCode);
        
        // Calculate bounds to show the cell with neighbors
        const cellBounds = result.bbox || result.bounds;
        console.log('[handleDecode] Cell bounds:', cellBounds);
        
        if (cellBounds) {
          const cellSizeMeters = result.grid_m || result.cellSize || 10;
          
          // Determinar zoom final baseado no tamanho da célula
          let finalZoom = 17;
          if (cellSizeMeters <= 10) {
            finalZoom = 18;
          } else if (cellSizeMeters <= 25) {
            finalZoom = 17;
          } else {
            finalZoom = 16;
          }
          
          console.log('[handleDecode] Flying to center with zoom:', finalZoom);
          
          // Voar diretamente para o zoom final para mostrar a célula com o ponto
          map.current.flyTo({
            center: [result.centroid.lon, result.centroid.lat],
            zoom: finalZoom,
            duration: 2000,
            pitch: 0,
            bearing: 0,
            essential: true
          });
        } else {
          // Fallback
          console.log('[handleDecode] Using fallback flyTo');
          map.current.flyTo({
            center: [result.centroid.lon, result.centroid.lat],
            zoom: 17,
            duration: 2000,
            pitch: 0
          });
        }
        
        // Clear selection panel - just show the highlighted cell on map
        setSelectedCell(null);
        
        toast.success(`${t('qgmap_toast_code_label')} ${result.afroloc} ${t('qgmap_toast_located')}`, {
          description: t('qgmap_toast_cell_highlighted')
        });
        
        // Auto-remove pulsing marker and highlight after 90 seconds
        setTimeout(() => {
          if (pulsingMarkerRef.current) {
            pulsingMarkerRef.current.remove();
            pulsingMarkerRef.current = null;
          }
          setHighlightedCellCode(null);
        }, 90000);
      }
    } catch (err) {
      toast.error(t('qgmap_toast_invalid_code'), {
        description: t('qgmap_toast_check_format')
      });
    } finally {
      setIsDecoding(false);
    }
  }, [decodeInput, decodeQG]);

  // Calculate density per grid cell
  const cellDensity = useMemo(() => {
    const density = new Map<string, { count: number; records: AfrolocRecord[] }>();
    
    gridCells.forEach(cell => {
      const bounds = cell.bbox || cell.bounds;
      if (!bounds) return;
      
      const recordsInCell = records.filter(record => {
        if (!record.geo_lat || !record.geo_lon) return false;
        const lat = Number(record.geo_lat);
        const lon = Number(record.geo_lon);
        return (
          lat >= bounds.minLat &&
          lat <= bounds.maxLat &&
          lon >= bounds.minLon &&
          lon <= bounds.maxLon
        );
      });
      
      const code = cell.afroloc || cell.qgCode || '';
      density.set(code, { count: recordsInCell.length, records: recordsInCell });
    });
    
    return density;
  }, [gridCells, records]);

  // Get max density for color scaling
  const maxDensity = useMemo(() => {
    let max = 0;
    cellDensity.forEach(({ count }) => {
      if (count > max) max = count;
    });
    return max;
  }, [cellDensity]);

  // Density statistics
  const densityStats = useMemo(() => {
    let hotZones = 0;
    let coldZones = 0;
    let coveredZones = 0;
    
    cellDensity.forEach(({ count }) => {
      const ratio = count / Math.max(maxDensity, 1);
      if (count === 0) coldZones++;
      else {
        coveredZones++;
        if (ratio > 0.7) hotZones++;
      }
    });
    
    return { hotZones, coldZones, coveredZones, totalCells: gridCells.length };
  }, [cellDensity, maxDensity, gridCells.length]);

  // Get records with GPS
  const recordsWithGPS = useMemo(() => 
    records.filter(r => r.geo_lat && r.geo_lon),
    [records]
  );

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        setMapboxToken(data.token);
      } catch (err) {
        console.error('Error fetching Mapbox token:', err);
      }
    };
    fetchToken();
  }, []);

  // Generate QG grid for visible area
  const generateGridForBounds = useCallback(async (bounds: mapboxgl.LngLatBounds) => {
    if (isGeneratingGrid) return;

    const zoom = map.current?.getZoom() ?? 10;
    // Gerar células a partir de zoom 12 para aparecerem mais cedo
    if (zoom < 12) {
      setGridCells([]);
      return;
    }

    setIsGeneratingGrid(true);

    try {
      const cells: QGResult[] = [];
      const seenCodes = new Set<string>();

      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();

      const latRange = ne.lat - sw.lat;
      const lonRange = ne.lng - sw.lng;
      if (latRange <= 0 || lonRange <= 0) {
        setGridCells([]);
        return;
      }

      // Mais densidade com mais zoom
      const gridDensity = Math.min(12, Math.max(4, Math.floor(zoom / 1.5)));

      const latStep = latRange / gridDensity;
      const lonStep = lonRange / gridDensity;

      for (let lat = sw.lat; lat <= ne.lat; lat += latStep) {
        for (let lon = sw.lng; lon <= ne.lng; lon += lonStep) {
          const qg = await computeQG(lat, lon, countryCode);
          const code = qg?.afroloc || qg?.qgCode;
          if (qg && code && !seenCodes.has(code)) {
            seenCodes.add(code);
            cells.push(qg);
          }
        }
      }

      setGridCells(cells);

      // Generate simulated towers for the visible area
      const simulatedTowers = generateSimulatedTowers(countryCode, {
        minLat: sw.lat,
        maxLat: ne.lat,
        minLon: sw.lng,
        maxLon: ne.lng
      });
      setTowers(simulatedTowers);
    } catch (err) {
      console.error('Error generating grid:', err);
    } finally {
      setIsGeneratingGrid(false);
    }
  }, [computeQG, countryCode, isGeneratingGrid]);

  // Keep function refs in sync
  useEffect(() => { generateGridForBoundsRef.current = generateGridForBounds; }, [generateGridForBounds]);
  useEffect(() => { computeFullGridRef.current = computeFullGrid; }, [computeFullGrid]);
  useEffect(() => { addCellToComparisonRef.current = addCellToComparison; }, [addCellToComparison]);

  // Generate batch codes for visible area
  const generateBatchCodes = useCallback(async () => {
    if (!map.current || isGeneratingBatch) return;
    setIsGeneratingBatch(true);
    setBatchCodes([]);
    
    try {
      const bounds = map.current.getBounds();
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      
      const cells: QGResult[] = [];
      const seenCodes = new Set<string>();
      
      // Calculate precise grid based on cell size (10m for urban)
      const zoom = map.current.getZoom();
      // Finer grid at higher zoom for more accurate coverage
      const gridDensity = Math.min(25, Math.max(10, Math.floor(zoom * 1.5)));
      
      const latStep = (ne.lat - sw.lat) / gridDensity;
      const lonStep = (ne.lng - sw.lng) / gridDensity;

      for (let lat = sw.lat; lat <= ne.lat; lat += latStep) {
        for (let lon = sw.lng; lon <= ne.lng; lon += lonStep) {
          const qg = await computeQG(lat, lon, countryCode);
          const code = qg?.afroloc || qg?.qgCode;
          if (qg && code && !seenCodes.has(code)) {
            seenCodes.add(code);
            cells.push(qg);
          }
        }
      }

      setBatchCodes(cells);
      setShowBatchPanel(true);
      toast.success(`${cells.length} ${t('qgmap_toast_codes_generated')}`);

    } catch (err) {
      console.error('Error generating batch codes:', err);
      toast.error(t('qgmap_toast_batch_error'));
    } finally {
      setIsGeneratingBatch(false);
    }
  }, [computeQG, countryCode, isGeneratingBatch]);

  // Export batch codes to CSV
  const exportBatchToCSV = useCallback(() => {
    if (batchCodes.length === 0) return;
    
    const headers = ['AFROLOC', 'Tipo', 'Tamanho (m)', 'Lat', 'Lon', 'MinLat', 'MaxLat', 'MinLon', 'MaxLon'];
    const rows = batchCodes.map(cell => {
      const bounds = cell.bbox || cell.bounds;
      return [
        cell.afroloc || cell.qgCode || '',
        cell.zone || cell.cellType || '',
        cell.grid_m || cell.cellSize || '',
        cell.centroid?.lat.toFixed(6) || '',
        cell.centroid?.lon.toFixed(6) || '',
        bounds?.minLat.toFixed(6) || '',
        bounds?.maxLat.toFixed(6) || '',
        bounds?.minLon.toFixed(6) || '',
        bounds?.maxLon.toFixed(6) || '',
      ].join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `afroloc-batch-${countryCode}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success(t('qgmap_toast_csv_exported'));
  }, [batchCodes, countryCode]);

  // State for saving to database
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  // Get user authorization level
  const { data: authLevel, isLoading: isLoadingAuth } = useAuthorizationLevel();
  const userLevel = authLevel?.current_level || 1;
  const canPreRegister = hasMinimumLevel(userLevel, MIN_LEVEL_CADASTRAL_PREREGISTER);
  const userJurisdiction = authLevel?.jurisdiction_country || countryCode;

  // Save batch codes to database with authorization check
  const saveBatchToDatabase = useCallback(async () => {
    if (batchCodes.length === 0) return;
    
    // Authorization check
    if (!canPreRegister) {
      toast.error(t('qgmap_toast_insufficient_auth'), {
        description: `${t('qgmap_toast_level')} ${MIN_LEVEL_CADASTRAL_PREREGISTER} (${LEVEL_NAMES[MIN_LEVEL_CADASTRAL_PREREGISTER as keyof typeof LEVEL_NAMES]}) ${t('qgmap_toast_or_higher_required')}`
      });
      return;
    }
    
    setIsSavingBatch(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('qgmap_toast_auth_required'));
        return;
      }
      
      // Get bounds from visible area
      const bounds = map.current?.getBounds();
      const ne = bounds?.getNorthEast();
      const sw = bounds?.getSouthWest();
      
      // Extract administrative division info from AFROLOC code format: CC-ZU-G10-XXXX-YYYY
      const firstCode = batchCodes[0];
      const adminInfo = firstCode?.afroloc?.split('-') || [];
      // AFROLOC format: [0]=country, [1]=zone, [2]=grid, [3]=x, [4]=y
      // We can derive level codes from the location or use auth level jurisdiction
      const level1Code = authLevel?.jurisdiction_level1_code || null;
      const level1Name = authLevel?.jurisdiction_level1_name || null;
      const level2Code = authLevel?.jurisdiction_level2_code || null;
      const level2Name = authLevel?.jurisdiction_level2_name || null;
      
      // Create batch generation record with jurisdiction info
      const { data: batchRecord, error: batchError } = await supabase
        .from('cadastral_batch_generations')
        .insert({
          generated_by_user_id: user.id,
          country_code: userJurisdiction || countryCode,
          level1_code: level1Code,
          level1_name: level1Name,
          level2_code: level2Code,
          level2_name: level2Name,
          min_lat: sw?.lat || 0,
          max_lat: ne?.lat || 0,
          min_lon: sw?.lng || 0,
          max_lon: ne?.lng || 0,
          total_cells_generated: batchCodes.length,
          urban_cells_count: batchCodes.filter(c => (c.zone || c.cellType) === 'urban').length,
          rural_cells_count: batchCodes.filter(c => (c.zone || c.cellType) === 'rural').length,
          area_hectares: batchCodes.reduce((acc, c) => {
            const size = c.grid_m || c.cellSize || 10;
            return acc + (size * size) / 10000;
          }, 0),
          status: 'completed'
        })
        .select()
        .single();
      
      if (batchError) throw batchError;
      
      // Prepare cell records with administrative division info
      const cellRecords = batchCodes.map(cell => {
        const cellBounds = cell.bbox || cell.bounds;
        return {
          afroloc_code: cell.afroloc || cell.qgCode || '',
          zone_type: (cell.zone || cell.cellType || 'urban') as 'urban' | 'rural',
          cell_size_meters: cell.grid_m || cell.cellSize || 10,
          centroid_lat: cell.centroid?.lat || 0,
          centroid_lon: cell.centroid?.lon || 0,
          min_lat: cellBounds?.minLat || 0,
          max_lat: cellBounds?.maxLat || 0,
          min_lon: cellBounds?.minLon || 0,
          max_lon: cellBounds?.maxLon || 0,
          country_code: userJurisdiction || countryCode,
          level1_code: level1Code,
          level1_name: level1Name,
          level2_code: level2Code,
          level2_name: level2Name,
          generated_by_user_id: user.id,
          generation_method: 'batch_map' as const,
          batch_id: batchRecord?.id,
          status: 'pending' as const
        };
      });
      
      // Insert cells (upsert to handle duplicates)
      const { error: cellsError } = await supabase
        .from('cadastral_grid_cells')
        .upsert(cellRecords, { 
          onConflict: 'afroloc_code',
          ignoreDuplicates: true 
        });
      
      if (cellsError) throw cellsError;
      
      toast.success(`${batchCodes.length} ${t('qgmap_toast_cells_preregistered')}`, {
        description: `${t('qgmap_toast_await_approval')} ${userLevel}`
      });
      
    } catch (err: any) {
      console.error('Error saving batch to database:', err);
      toast.error(t('qgmap_toast_db_save_error'), {
        description: err.message || t('qgmap_toast_try_again')
      });
    } finally {
      setIsSavingBatch(false);
    }
  }, [batchCodes, countryCode, canPreRegister, userLevel, userJurisdiction, authLevel]);

  // Toggle map style
  const toggleMapStyle = useCallback(() => {
    if (!map.current) return;
    const newStyle = mapStyle === 'streets' 
      ? 'mapbox://styles/mapbox/satellite-streets-v12' 
      : 'mapbox://styles/mapbox/streets-v12';
    
    map.current.setStyle(newStyle);
    setMapStyle(prev => prev === 'streets' ? 'satellite' : 'streets');
    
    // Re-add sources and layers after style change
    map.current.once('style.load', () => {
      if (!map.current) return;
      
      // Re-add all sources
      if (!map.current.getSource('qg-grid')) {
        map.current.addSource('qg-grid', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      }
      if (!map.current.getSource('sq-grid')) {
        map.current.addSource('sq-grid', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      }
      if (!map.current.getSource('addresses')) {
        map.current.addSource('addresses', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      }
      if (!map.current.getSource('tower-coverage')) {
        map.current.addSource('tower-coverage', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      }
      if (!map.current.getSource('tower-markers')) {
        map.current.addSource('tower-markers', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      }
      
      // Regenerate grid
      const bounds = map.current.getBounds();
      if (generateGridForBoundsRef.current) {
        generateGridForBoundsRef.current(bounds);
      }
    });
  }, [mapStyle]);

  // Generate SQ subdivisions for a QG cell
  const generateSQForCell = useCallback(async (qgResult: QGResult) => {
    const code = qgResult.afroloc || qgResult.qgCode || '';
    if (sqCells.has(code)) return;

    try {
      // Get center of the QG cell
      const bounds = qgResult.bbox || qgResult.bounds;
      if (!bounds) return;
      
      const centerLat = (bounds.minLat + bounds.maxLat) / 2;
      const centerLon = (bounds.minLon + bounds.maxLon) / 2;

      const sq = await computeSQ(qgResult, centerLat, centerLon, countryCode);
      if (sq) {
        setSqCells(prev => new Map(prev).set(code, sq));
      }
    } catch (err) {
      console.error('Error generating SQ:', err);
    }
  }, [computeSQ, countryCode, sqCells]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || map.current) return;

    mapboxgl.accessToken = mapboxToken;

    try {
      // Calculate center from records if available
      let center = initialCenter;
      let zoom = initialZoom;

      if (recordsWithGPS.length > 0) {
        const avgLat = recordsWithGPS.reduce((sum, r) => sum + Number(r.geo_lat), 0) / recordsWithGPS.length;
        const avgLon = recordsWithGPS.reduce((sum, r) => sum + Number(r.geo_lon), 0) / recordsWithGPS.length;
        center = [avgLon, avgLat];
        zoom = recordsWithGPS.length === 1 ? 15 : 12;
      }

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center,
        zoom,
        failIfMajorPerformanceCaveat: false,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.current.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');

      map.current.on('load', () => {
        if (!map.current) return;

        // Add source for QG grid polygons
        map.current.addSource('qg-grid', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        // Add source for SQ grid polygons
        map.current.addSource('sq-grid', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        // Add source for address markers
        map.current.addSource('addresses', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        // Add source for tower coverage polygons
        map.current.addSource('tower-coverage', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        // Add source for tower markers
        map.current.addSource('tower-markers', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        // Tower coverage fill layer
        map.current.addLayer({
          id: 'tower-coverage-fill',
          type: 'fill',
          source: 'tower-coverage',
          paint: {
            'fill-color': ['get', 'fillColor'],
            'fill-opacity': 0.3
          }
        });

        // Tower coverage stroke layer
        map.current.addLayer({
          id: 'tower-coverage-stroke',
          type: 'line',
          source: 'tower-coverage',
          paint: {
            'line-color': ['get', 'strokeColor'],
            'line-width': 1.5,
            'line-dasharray': [3, 2]
          }
        });

        // QG grid fill layer - visível a partir de zoom 12
        map.current.addLayer({
          id: 'qg-grid-fill',
          type: 'fill',
          source: 'qg-grid',
          minzoom: 12,
          maxzoom: 22,
          paint: {
            'fill-color': ['get', 'fillColor'],
            'fill-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.15, 15, 0.3, 17, 0.4, 19, 0.5]
          }
        });

        // QG grid stroke layer - visível a partir de zoom 12
        map.current.addLayer({
          id: 'qg-grid-stroke',
          type: 'line',
          source: 'qg-grid',
          minzoom: 12,
          maxzoom: 22,
          paint: {
            'line-color': ['get', 'strokeColor'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 15, 1, 17, 1.5, 19, 2]
          }
        });

        // SQ grid fill layer (sub-células) - só a partir de zoom alto
        map.current.addLayer({
          id: 'sq-grid-fill',
          type: 'fill',
          source: 'sq-grid',
          minzoom: 18,
          maxzoom: 22,
          paint: {
            'fill-color': GRID_COLORS.sq.fill,
            'fill-opacity': 0.5
          }
        });

        // SQ grid stroke layer (sub-células) - só a partir de zoom alto
        map.current.addLayer({
          id: 'sq-grid-stroke',
          type: 'line',
          source: 'sq-grid',
          minzoom: 18,
          maxzoom: 22,
          paint: {
            'line-color': GRID_COLORS.sq.stroke,
            'line-width': 1.5
          }
        });

        // QG labels layer - abbreviated labels, visível a partir de zoom 14
        map.current.addLayer({
          id: 'qg-labels',
          type: 'symbol',
          source: 'qg-grid',
          minzoom: 14,
          maxzoom: 22,
          layout: {
            'text-field': ['get', 'shortLabel'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 14, 8, 16, 11, 18, 14, 20, 18],
            'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
            'text-anchor': 'center',
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'text-padding': 4,
            'text-optional': true
          },
          paint: {
            'text-color': '#FFFFFF',
            'text-halo-color': 'rgba(0, 0, 0, 0.85)',
            'text-halo-width': ['interpolate', ['linear'], ['zoom'], 14, 1, 16, 1.5, 18, 2, 20, 2.5],
            'text-halo-blur': 0.3
          }
        });

        // Address markers - outer glow ring for visibility
        map.current.addLayer({
          id: 'address-markers-glow',
          type: 'circle',
          source: 'addresses',
          minzoom: 5,
          maxzoom: 22,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 12, 14, 20, 18, 35, 20, 45],
            'circle-color': ['get', 'color'],
            'circle-stroke-width': 0,
            'circle-opacity': 0.2,
            'circle-blur': 0.8
          }
        });

        // Address markers pulse effect (animated ring)
        map.current.addLayer({
          id: 'address-markers-pulse',
          type: 'circle',
          source: 'addresses',
          minzoom: 5,
          maxzoom: 22,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 14, 14, 24, 18, 40, 20, 50],
            'circle-color': ['get', 'color'],
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 18, 4, 20, 5],
            'circle-stroke-color': ['get', 'color'],
            'circle-opacity': 0.15
          }
        });

        // Address markers layer - main pinpoint marker
        map.current.addLayer({
          id: 'address-markers',
          type: 'circle',
          source: 'addresses',
          minzoom: 5,
          maxzoom: 22,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 8, 14, 14, 18, 22, 20, 28],
            'circle-color': ['get', 'color'],
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 14, 4, 18, 6, 20, 8],
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 1
          }
        });

        // Address markers - inner dot for pin effect
        map.current.addLayer({
          id: 'address-markers-inner',
          type: 'circle',
          source: 'addresses',
          minzoom: 14,
          maxzoom: 22,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 4, 18, 8, 20, 10],
            'circle-color': '#ffffff',
            'circle-opacity': 0.9
          }
        });

        // Address code labels at high zoom
        map.current.addLayer({
          id: 'address-labels',
          type: 'symbol',
          source: 'addresses',
          minzoom: 17,
          layout: {
            'text-field': ['get', 'code'],
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 17, 10, 19, 12, 20, 14],
            'text-offset': [0, 2.5],
            'text-anchor': 'top',
            'text-max-width': 15
          },
          paint: {
            'text-color': '#1a1a2e',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
            'text-halo-blur': 0.5
          }
        });

        // Tower markers layer
        map.current.addLayer({
          id: 'tower-markers',
          type: 'circle',
          source: 'tower-markers',
          paint: {
            'circle-radius': 10,
            'circle-color': ['get', 'markerColor'],
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff'
          }
        });

        // Tower icons layer
        map.current.addLayer({
          id: 'tower-icons',
          type: 'symbol',
          source: 'tower-markers',
          layout: {
            'text-field': '📡',
            'text-size': 14,
            'text-anchor': 'center',
            'text-allow-overlap': true
          }
        });

        // Generate initial grid after a short delay to ensure refs are set
        setTimeout(() => {
          if (!map.current) return;
          const bounds = map.current.getBounds();
          if (generateGridForBoundsRef.current) {
            generateGridForBoundsRef.current(bounds);
          }
        }, 100);

        // Update grid on move end and zoom end
        map.current.on('moveend', () => {
          if (!map.current || !generateGridForBoundsRef.current) return;
          const newBounds = map.current.getBounds();
          generateGridForBoundsRef.current(newBounds);
        });

        // Also regenerate grid during zoom to prevent disappearing
        map.current.on('zoomend', () => {
          if (!map.current || !generateGridForBoundsRef.current) return;
          const newBounds = map.current.getBounds();
          generateGridForBoundsRef.current(newBounds);
        });

        // Click handler for grid cells
        map.current.on('click', 'qg-grid-fill', async (e) => {
          if (!e.features || !e.features[0]) return;
          const props = e.features[0].properties;
          if (!props) return;

          const qgCode = props.qgCode || props.afroloc;
          if (!qgCode) return;

          // Highlight clicked cell and show only the grid (no side detail panel)
          setHighlightedCellCode(qgCode);
          setSelectedCell(null);
          setSelectedTower(null);

          // Hide extra overlays to show only the grid
          setShowMarkers(false);
          setShowTowers(false);
          setShowCoverage(false);
          setShowDensity(false);
          setShowSQGrid(false);
          setShowQGGrid(true);

          // Center on the clicked cell
          const cell = gridCellsRef.current.find(c => (c.afroloc || c.qgCode) === qgCode);
          const bounds = cell?.bbox || cell?.bounds;
          if (bounds && map.current) {
            map.current.flyTo({
              center: [(bounds.minLon + bounds.maxLon) / 2, (bounds.minLat + bounds.maxLat) / 2],
              zoom: Math.max(map.current.getZoom(), 16),
              duration: 800,
              pitch: 0,
              bearing: 0
            });
          }
        });

        // Click handler for tower markers
        map.current.on('click', 'tower-markers', (e) => {
          if (!e.features || !e.features[0]) return;
          const props = e.features[0].properties;
          if (!props) return;

          const tower = towersRef.current.find(t => t.id === props.id);
          if (tower) {
            setSelectedTower(tower);
            setSelectedCell(null);
          }
        });

        // Cursor styling
        map.current.on('mouseenter', 'qg-grid-fill', () => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'qg-grid-fill', () => {
          if (map.current) map.current.getCanvas().style.cursor = '';
        });
        map.current.on('mouseenter', 'tower-markers', () => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'tower-markers', () => {
          if (map.current) map.current.getCanvas().style.cursor = '';
        });

        // Generic map click handler - for proposing AFROLOC creation
        map.current.on('click', async (e) => {
          // Don't trigger if clicking on a grid cell or tower
          const features = map.current?.queryRenderedFeatures(e.point, {
            layers: ['qg-grid-fill', 'tower-markers']
          });
          if (features && features.length > 0) return;
          
          const { lng, lat } = e.lngLat;
          console.log('[Map Click] Coordinates:', lat, lng);
          
          // Set loading state for proposal
          setClickProposal({ lat, lon: lng, qgResult: null, isLoading: true });
          
          try {
            // Compute QG code for clicked location
            const result = await computeQG(lat, lng, countryCode);
            console.log('[Map Click] QG Result:', result);
            
            if (result) {
              setClickProposal({ lat, lon: lng, qgResult: result, isLoading: false });
              
              // Add temporary marker at click location
              if (pulsingMarkerRef.current) {
                pulsingMarkerRef.current.remove();
              }
              
              const markerEl = document.createElement('div');
              markerEl.className = 'map-marker-wrapper';
              markerEl.innerHTML = '<div class="map-marker-pulse"><div class="map-marker-inner"></div></div>';
              
              pulsingMarkerRef.current = new mapboxgl.Marker({ element: markerEl })
                .setLngLat([lng, lat])
                .addTo(map.current!);
              
              // Add the computed cell to grid for visualization
              setGridCells(prev => {
                const code = result.afroloc || result.qgCode || '';
                const exists = prev.some(c => (c.afroloc || c.qgCode) === code);
                if (exists) return prev;
                return [...prev, result];
              });
              
              setHighlightedCellCode(result.afroloc || result.qgCode || '');
            }
          } catch (err) {
            console.error('[Map Click] Error computing QG:', err);
            setClickProposal(null);
            toast.error(t('qgmap_toast_compute_error'));
          }
        });
      });

    } catch (err) {
      console.error('Failed to initialize map:', err);
      setWebGLError(true);
    }

    return () => {
      // Clean up pulsing marker
      if (pulsingMarkerRef.current) {
        pulsingMarkerRef.current.remove();
        pulsingMarkerRef.current = null;
      }
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken, initialCenter, initialZoom, countryCode]);

  // Update QG grid source with density colors
  useEffect(() => {
    if (!map.current || !map.current.getSource('qg-grid')) return;

    const features: GeoJSON.Feature[] = gridCells.map(cell => {
      const code = cell.afroloc || cell.qgCode || '';
      const bounds = cell.bbox || cell.bounds;
      const cellType = cell.zone || cell.cellType;
      const cellSize = cell.grid_m || cell.cellSize;
      
      const density = cellDensity.get(code);
      const count = density?.count || 0;
      const densityColor = showDensity ? getDensityColor(count, maxDensity) : null;
      
      // Create abbreviated labels for better readability
      // Full code: AO-LUA-ING-G10-4-5 → Short: G10-4-5 or just 4-5
      const codeParts = code.split('-');
      let shortLabel = '';
      let tinyLabel = '';
      
      if (codeParts.length >= 6) {
        // Format: CC-PROV-MUN-COM-BAI-GRID or CC-PROV-MUN-GRID-X-Y
        const gridPart = codeParts.find(p => p.startsWith('G') && /^G\d+/.test(p));
        if (gridPart) {
          const gridIndex = codeParts.indexOf(gridPart);
          shortLabel = codeParts.slice(gridIndex).join('-'); // G10-4-5
          tinyLabel = codeParts.slice(gridIndex + 1).join('-') || gridPart; // 4-5 or G10
        } else {
          shortLabel = codeParts.slice(-3).join('-');
          tinyLabel = codeParts.slice(-2).join('-');
        }
      } else if (codeParts.length >= 4) {
        shortLabel = codeParts.slice(-2).join('-');
        tinyLabel = codeParts.slice(-1)[0] || '';
      } else {
        shortLabel = code.substring(0, 10);
        tinyLabel = code.substring(0, 6);
      }
      
      // For density mode, show count
      const displayLabel = showDensity && count > 0 ? `${count}` : shortLabel;
      const displayTinyLabel = showDensity && count > 0 ? `${count}` : tinyLabel;
      
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [bounds?.minLon || 0, bounds?.minLat || 0],
            [bounds?.maxLon || 0, bounds?.minLat || 0],
            [bounds?.maxLon || 0, bounds?.maxLat || 0],
            [bounds?.minLon || 0, bounds?.maxLat || 0],
            [bounds?.minLon || 0, bounds?.minLat || 0],
          ]]
        },
        properties: {
          qgCode: code,
          afroloc: code,
          fullCode: code,
          cellType: cellType,
          cellSize: cellSize,
          label: displayLabel,
          shortLabel: displayLabel,
          tinyLabel: displayTinyLabel,
          recordCount: count,
          densityLevel: densityColor?.level || 'none',
          isHighlighted: code === highlightedCellCode,
          fillColor: code === highlightedCellCode 
            ? 'rgba(239, 68, 68, 0.6)' // Red highlight for searched cell
            : (densityColor ? densityColor.fill : (cellType === 'urban' ? GRID_COLORS.urban.fill : GRID_COLORS.rural.fill)),
          strokeColor: code === highlightedCellCode 
            ? '#dc2626' // Bold red stroke for searched cell
            : (densityColor ? densityColor.stroke : (cellType === 'urban' ? GRID_COLORS.urban.stroke : GRID_COLORS.rural.stroke)),
          strokeWidth: code === highlightedCellCode ? 5 : 2,
        }
      };
    });

    const source = map.current.getSource('qg-grid') as mapboxgl.GeoJSONSource;
    source.setData({ type: 'FeatureCollection', features });

    // Generate SQ for each cell only when zoomed in enough
    const zoom = map.current.getZoom();
    if (showSQGrid && zoom >= 18) {
      gridCells.forEach(cell => generateSQForCell(cell));
    }
  }, [gridCells, generateSQForCell, cellDensity, maxDensity, showDensity, highlightedCellCode, showSQGrid]);

  // Update SQ grid source
  useEffect(() => {
    if (!map.current || !map.current.getSource('sq-grid')) return;

    const features: GeoJSON.Feature[] = [];
    
    sqCells.forEach((sq, qgCode) => {
      // Find parent QG cell
      const parent = gridCells.find(c => (c.afroloc || c.qgCode) === qgCode);
      if (!parent) return;
      
      const parentBounds = parent.bbox || parent.bounds;
      if (!parentBounds) return;

      // Generate all subdivision cells
      const gridSize = sq.subdivisionType === '2x2' ? 2 : sq.subdivisionType === '3x3' ? 3 : 4;
      const latStep = (parentBounds.maxLat - parentBounds.minLat) / gridSize;
      const lonStep = (parentBounds.maxLon - parentBounds.minLon) / gridSize;

      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          const minLat = parentBounds.minLat + row * latStep;
          const maxLat = parentBounds.minLat + (row + 1) * latStep;
          const minLon = parentBounds.minLon + col * lonStep;
          const maxLon = parentBounds.minLon + (col + 1) * lonStep;

          features.push({
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [minLon, minLat],
                [maxLon, minLat],
                [maxLon, maxLat],
                [minLon, maxLat],
                [minLon, minLat],
              ]]
            },
            properties: {
              sqCode: sq.fullCode,
              subdivisionType: sq.subdivisionType,
              row,
              col
            }
          });
        }
      }
    });

    const source = map.current.getSource('sq-grid') as mapboxgl.GeoJSONSource;
    source.setData({ type: 'FeatureCollection', features });
  }, [sqCells, gridCells]);

  // Update address markers
  useEffect(() => {
    if (!map.current || !map.current.getSource('addresses')) return;

    const features: GeoJSON.Feature[] = recordsWithGPS.map(record => {
      // Create abbreviated code for display
      const codeParts = record.code.split('-');
      let shortCode = record.code;
      
      if (codeParts.length >= 6) {
        const gridPart = codeParts.find(p => p.startsWith('G') && /^G\d+/.test(p));
        if (gridPart) {
          const gridIndex = codeParts.indexOf(gridPart);
          shortCode = codeParts.slice(gridIndex).join('-');
        } else {
          shortCode = codeParts.slice(-3).join('-');
        }
      } else if (codeParts.length >= 4) {
        shortCode = codeParts.slice(-2).join('-');
      }
      
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [Number(record.geo_lon), Number(record.geo_lat)]
        },
        properties: {
          id: record.id,
          code: shortCode,
          fullCode: record.code,
          status: record.status,
          color: record.status === 'certified' ? '#10b981' : record.status === 'verified' ? '#3b82f6' : '#f59e0b'
        }
      };
    });

    const source = map.current.getSource('addresses') as mapboxgl.GeoJSONSource;
    source.setData({ type: 'FeatureCollection', features });
  }, [recordsWithGPS]);

  // Update tower coverage and markers
  useEffect(() => {
    if (!map.current) return;

    // Update tower coverage polygons
    if (map.current.getSource('tower-coverage')) {
      const coverageFeatures: GeoJSON.Feature[] = towers.map(tower => ({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [generateCoveragePolygon(tower.lat, tower.lon, tower.coverageRadius)]
        },
        properties: {
          id: tower.id,
          type: tower.type,
          fillColor: GRID_COLORS.tower[tower.type].fill,
          strokeColor: GRID_COLORS.tower[tower.type].stroke,
        }
      }));

      const coverageSource = map.current.getSource('tower-coverage') as mapboxgl.GeoJSONSource;
      coverageSource.setData({ type: 'FeatureCollection', features: coverageFeatures });
    }

    // Update tower markers
    if (map.current.getSource('tower-markers')) {
      const markerFeatures: GeoJSON.Feature[] = towers.map(tower => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [tower.lon, tower.lat]
        },
        properties: {
          id: tower.id,
          name: tower.name,
          operator: tower.operator,
          type: tower.type,
          signalStrength: tower.signalStrength,
          markerColor: GRID_COLORS.tower[tower.type].marker,
        }
      }));

      const markerSource = map.current.getSource('tower-markers') as mapboxgl.GeoJSONSource;
      markerSource.setData({ type: 'FeatureCollection', features: markerFeatures });
    }
  }, [towers]);

  // Toggle layer visibility
  useEffect(() => {
    if (!map.current) return;

    const qgLayers = ['qg-grid-fill', 'qg-grid-stroke', 'qg-labels'];
    const sqLayers = ['sq-grid-fill', 'sq-grid-stroke'];
    const markerLayers = ['address-markers', 'address-markers-glow', 'address-markers-pulse', 'address-markers-inner', 'address-labels'];
    const towerLayers = ['tower-markers', 'tower-icons'];
    const coverageLayers = ['tower-coverage-fill', 'tower-coverage-stroke'];

    qgLayers.forEach(layer => {
      if (map.current?.getLayer(layer)) {
        map.current.setLayoutProperty(layer, 'visibility', showQGGrid ? 'visible' : 'none');
      }
    });

    sqLayers.forEach(layer => {
      if (map.current?.getLayer(layer)) {
        map.current.setLayoutProperty(layer, 'visibility', showSQGrid ? 'visible' : 'none');
      }
    });

    markerLayers.forEach(layer => {
      if (map.current?.getLayer(layer)) {
        map.current.setLayoutProperty(layer, 'visibility', showMarkers ? 'visible' : 'none');
      }
    });

    towerLayers.forEach(layer => {
      if (map.current?.getLayer(layer)) {
        map.current.setLayoutProperty(layer, 'visibility', showTowers ? 'visible' : 'none');
      }
    });

    coverageLayers.forEach(layer => {
      if (map.current?.getLayer(layer)) {
        map.current.setLayoutProperty(layer, 'visibility', showCoverage ? 'visible' : 'none');
      }
    });
  }, [showQGGrid, showSQGrid, showMarkers, showTowers, showCoverage]);

  // Tower stats
  const towerStats = useMemo(() => {
    const stats = {
      total: towers.length,
      by4G: towers.filter(t => t.type === '4G').length,
      by3G: towers.filter(t => t.type === '3G').length,
      by2G: towers.filter(t => t.type === '2G').length,
      byOperator: {} as Record<string, number>,
    };
    
    towers.forEach(t => {
      stats.byOperator[t.operator] = (stats.byOperator[t.operator] || 0) + 1;
    });
    
    return stats;
  }, [towers]);

  if (!mapboxToken) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-muted rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (webGLError) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <Grid3X3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t('qgmap_webgl_unsupported')}</p>
          <p className="text-sm">{t('qgmap_webgl_hint')}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Decode AFROLOC Code */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 w-full">
            <Label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Search className="h-4 w-4" />
              {t('qgmap_locate_code')}
            </Label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder={t('qgmap_locate_placeholder')}
                value={decodeInput}
                onChange={(e) => setDecodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleDecode()}
                className="font-mono"
              />
              <Button 
                onClick={handleDecode} 
                disabled={isDecoding || !decodeInput.trim()}
                className="shrink-0"
              >
                {isDecoding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Navigation className="h-4 w-4 mr-2" />
                    {t('qgmap_locate')}
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('qgmap_format_hint')}
            </p>
          </div>
        </div>
      </Card>

      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              id="show-qg"
              checked={showQGGrid}
              onCheckedChange={setShowQGGrid}
            />
            <Label htmlFor="show-qg" className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 bg-blue-500/20 rounded" />
              {t('qgmap_qg_grid')}
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="show-sq"
              checked={showSQGrid}
              onCheckedChange={setShowSQGrid}
            />
            <Label htmlFor="show-sq" className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-orange-500 bg-orange-500/20 rounded" />
              {t('qgmap_sq_subdivisions')}
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="show-markers"
              checked={showMarkers}
              onCheckedChange={setShowMarkers}
            />
            <Label htmlFor="show-markers" className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              {t('qgmap_addresses')}
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="show-towers"
              checked={showTowers}
              onCheckedChange={setShowTowers}
            />
            <Label htmlFor="show-towers" className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-violet-500" />
              {t('qgmap_towers')}
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="show-coverage"
              checked={showCoverage}
              onCheckedChange={setShowCoverage}
            />
            <Label htmlFor="show-coverage" className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-pink-500" />
              {t('qgmap_coverage')}
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="show-density"
              checked={showDensity}
              onCheckedChange={setShowDensity}
            />
            <Label htmlFor="show-density" className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-red-500" />
              {t('qgmap_density_heatmap')}
            </Label>
          </div>

          <div className="flex items-center gap-2 border-l pl-4 ml-2">
            <Switch
              id="comparison-mode"
              checked={comparisonMode}
              onCheckedChange={(checked) => {
                setComparisonMode(checked);
                if (!checked) {
                  clearComparison();
                }
              }}
            />
            <Label htmlFor="comparison-mode" className="flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-violet-500" />
              {t('qgmap_compare_cells')}
            </Label>
            {comparisonCells.length > 0 && (
              <Badge variant="outline" className="ml-1">
                {comparisonCells.length}/5
              </Badge>
            )}
          </div>

          {/* Batch Generation Button */}
          <div className="flex items-center gap-2 border-l pl-4 ml-2">
            <Button
              variant={showBatchPanel ? "secondary" : "outline"}
              size="sm"
              onClick={generateBatchCodes}
              disabled={isGeneratingBatch}
              className="flex items-center gap-2"
            >
              {isGeneratingBatch ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {t('qgmap_generate_batch')}
            </Button>
          </div>

          {/* Map Style Toggle */}
          <div className="flex items-center gap-2 border-l pl-4 ml-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMapStyle}
              className="flex items-center gap-2"
            >
              {mapStyle === 'streets' ? (
                <>
                  <Satellite className="h-4 w-4" />
                  {t('qgmap_satellite')}
                </>
              ) : (
                <>
                  <MapIcon className="h-4 w-4" />
                  {t('qgmap_map')}
                </>
              )}
            </Button>
          </div>

          {(loading || isGeneratingGrid || isGeneratingBatch) && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {isGeneratingBatch ? t('qgmap_generating_batch') : t('qgmap_computing')}
            </Badge>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="text-sm">
                  <strong>{t('qgmap_qg_grid')}:</strong> {t('qgmap_info_qg_grid')}
                  <br />
                  <strong>{t('qgmap_sq_subdivisions')}:</strong> {t('qgmap_info_sq_subdivisions')}
                  <br />
                  <strong>{t('qgmap_towers')}:</strong> {t('qgmap_info_towers')}
                  <br />
                  <strong>{t('qgmap_coverage')}:</strong> {t('qgmap_info_coverage')}
                  <br />
                  <strong>{t('qgmap_density_heatmap')}:</strong> {t('qgmap_info_density_heatmap')}
                  <br />
                  <strong>{t('qgmap_generate_batch')}:</strong> {t('qgmap_info_generate_batch')}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </Card>

      {/* Batch Generation Panel */}
      {showBatchPanel && batchCodes.length > 0 && (
        <Card className="p-4 border-2 border-primary/30">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Square className="h-4 w-4 text-primary" />
                {t('qgmap_batch_generated_codes')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {batchCodes.length} {t('qgmap_batch_unique_codes')}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {/* Authorization level indicator */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant={canPreRegister ? "default" : "secondary"} 
                      className={`flex items-center gap-1 ${canPreRegister ? 'bg-green-500' : 'bg-orange-500'}`}
                    >
                      {canPreRegister ? <Shield className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {t('qgmap_level')} {userLevel}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {canPreRegister
                      ? `${t('qgmap_auth_tooltip_authorized')} (${t('qgmap_level')} ${userLevel})`
                      : `${t('qgmap_level')} ${MIN_LEVEL_CADASTRAL_PREREGISTER} ${t('qgmap_auth_tooltip_required')}`
                    }
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <Button
                variant="default"
                size="sm"
                onClick={saveBatchToDatabase}
                disabled={isSavingBatch || !canPreRegister || isLoadingAuth}
                className="flex items-center gap-2"
              >
                {isSavingBatch ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : canPreRegister ? (
                  <Layers className="h-4 w-4" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {canPreRegister ? t('qgmap_register_db') : t('qgmap_insufficient_level')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportBatchToCSV}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {t('qgmap_export_csv')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBatchPanel(false)}
              >
                ×
              </Button>
            </div>
          </div>
          
          {/* Authorization warning if not authorized */}
          {!canPreRegister && !isLoadingAuth && (
            <Alert className="mb-4 border-orange-200 bg-orange-50 dark:bg-orange-950">
              <Lock className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>{t('qgmap_alert_prereg_requires')} {MIN_LEVEL_CADASTRAL_PREREGISTER} ({LEVEL_NAMES[MIN_LEVEL_CADASTRAL_PREREGISTER as keyof typeof LEVEL_NAMES]})</strong>
                <br />
                {t('qgmap_alert_your_level')}: {userLevel} ({LEVEL_NAMES[userLevel as keyof typeof LEVEL_NAMES] || t('qgmap_level_basic')}).
                {' '}{t('qgmap_alert_csv_only')}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="bg-muted/50 p-2 rounded">
              <p className="text-xs text-muted-foreground">{t('qgmap_total_cells')}</p>
              <p className="font-semibold text-lg">{batchCodes.length}</p>
            </div>
            <div className="bg-blue-500/10 p-2 rounded">
              <p className="text-xs text-muted-foreground">{t('qgmap_urban_cells')}</p>
              <p className="font-semibold text-lg text-blue-500">
                {batchCodes.filter(c => (c.zone || c.cellType) === 'urban').length}
              </p>
            </div>
            <div className="bg-green-500/10 p-2 rounded">
              <p className="text-xs text-muted-foreground">{t('qgmap_rural_cells')}</p>
              <p className="font-semibold text-lg text-green-500">
                {batchCodes.filter(c => (c.zone || c.cellType) === 'rural').length}
              </p>
            </div>
            <div className="bg-muted/50 p-2 rounded">
              <p className="text-xs text-muted-foreground">{t('qgmap_area_covered')}</p>
              <p className="font-semibold text-lg">
                ~{(batchCodes.reduce((acc, c) => {
                  const size = c.grid_m || c.cellSize || 10;
                  return acc + (size * size);
                }, 0) / 10000).toFixed(2)} ha
              </p>
            </div>
          </div>
          
          <div className="max-h-48 overflow-y-auto border rounded p-2 bg-muted/30">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
              {batchCodes.slice(0, 50).map((cell, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between bg-background p-1.5 rounded text-xs"
                >
                  <code className="font-mono truncate flex-1 mr-1">
                    {(cell.afroloc || cell.qgCode || '').split('-').slice(-2).join('-')}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={() => copyCode(cell.afroloc || cell.qgCode || '')}
                  >
                    {copiedCode === (cell.afroloc || cell.qgCode) ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ))}
              {batchCodes.length > 50 && (
                <div className="col-span-full text-center text-xs text-muted-foreground py-2">
                  {t('qgmap_and_more')} {batchCodes.length - 50} {t('qgmap_codes_export_all')}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Map */}
      <div className="relative">
        <div ref={mapContainer} className="w-full h-[600px] rounded-lg shadow-lg" />

        {/* Legend - Click to hide */}
        {showLegendPanel && (
        <Card 
          className="absolute bottom-4 left-4 p-3 bg-background/95 backdrop-blur max-w-xs cursor-pointer transition-opacity hover:opacity-90"
          onClick={() => setShowLegendPanel(false)}
          title={t('qgmap_click_to_hide')}
        >
          <div className="space-y-2 text-xs">
            {showDensity && (
              <>
                <div className="font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <Thermometer className="h-3 w-3" />
                  {t('map_legend_density_scale')}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 bg-blue-500/25 rounded" />
                  <span>{t('map_legend_cold_zone')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-green-500 bg-green-500/35 rounded" />
                  <span>{t('map_legend_low_density')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-amber-500 bg-amber-500/45 rounded" />
                  <span>{t('map_legend_medium_density')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-orange-500 bg-orange-500/55 rounded" />
                  <span>{t('map_legend_high_density')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-red-500 bg-red-500/65 rounded" />
                  <span>{t('map_legend_hot_zone')}</span>
                </div>
              </>
            )}
            {!showDensity && (
              <>
                <div className="font-semibold text-muted-foreground mb-2">{t('map_legend_grid')}</div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 bg-blue-500/20 rounded" />
                  <span>{t('map_legend_urban_qg')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-green-500 bg-green-500/20 rounded" />
                  <span>{t('map_legend_rural_qg')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-orange-500 bg-orange-500/20 rounded" />
                  <span>{t('map_legend_sq_subdivision')}</span>
                </div>
              </>
            )}
            <div className="font-semibold text-muted-foreground mt-3 mb-2">{t('map_legend_telecom')}</div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-violet-500" />
              <span>{t('map_legend_4g_tower')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-pink-500" />
              <span>{t('map_legend_3g_tower')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-amber-500" />
              <span>{t('map_legend_2g_tower')}</span>
            </div>
          </div>
        </Card>
        )}

        {/* Stats - Click to hide */}
        {showStatsPanel && (
        <Card 
          className="absolute top-4 right-4 p-3 bg-background/95 backdrop-blur cursor-pointer transition-opacity hover:opacity-90"
          onClick={() => setShowStatsPanel(false)}
          title={t('qgmap_click_to_hide')}
        >
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{t('map_stats_qg_cells')}:</span>
              <span className="font-medium">{gridCells.length}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{t('map_stats_sq_computed')}:</span>
              <span className="font-medium">{sqCells.size}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{t('map_stats_addresses')}:</span>
              <span className="font-medium">{recordsWithGPS.length}</span>
            </div>
            
            {/* Density Stats */}
            {showDensity && (
              <div className="border-t pt-1 mt-1">
                <div className="font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <Thermometer className="h-3 w-3" />
                  {t('map_stats_coverage_analysis')}
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-red-500 flex items-center gap-1">🔥 {t('map_stats_hot_zones')}:</span>
                  <span className="font-medium">{densityStats.hotZones}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-blue-500 flex items-center gap-1">❄️ {t('map_stats_cold_zones')}:</span>
                  <span className="font-medium">{densityStats.coldZones}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-green-500 flex items-center gap-1">✓ {t('map_stats_covered')}:</span>
                  <span className="font-medium">{densityStats.coveredZones}</span>
                </div>
                <div className="flex items-center justify-between gap-4 mt-1">
                  <span className="text-muted-foreground">{t('map_stats_max_density')}:</span>
                  <span className="font-medium">{maxDensity}</span>
                </div>
              </div>
            )}
            
            <div className="border-t pt-1 mt-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Radio className="h-3 w-3" /> {t('map_stats_towers')}:
                </span>
                <span className="font-medium">{towerStats.total}</span>
              </div>
              <div className="flex gap-2 mt-1">
                <Badge variant="secondary" className="text-[10px] px-1 py-0">4G: {towerStats.by4G}</Badge>
                <Badge variant="secondary" className="text-[10px] px-1 py-0">3G: {towerStats.by3G}</Badge>
                <Badge variant="secondary" className="text-[10px] px-1 py-0">2G: {towerStats.by2G}</Badge>
              </div>
            </div>
          </div>
        </Card>
        )}

        {/* Buttons to show hidden panels */}
        {(!showLegendPanel || !showStatsPanel) && (
          <div className="absolute bottom-4 right-4 flex gap-2">
            {!showLegendPanel && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowLegendPanel(true)}
                className="bg-background/95 backdrop-blur"
              >
                <Thermometer className="h-4 w-4 mr-1" />
                {t('map_legend')}
              </Button>
            )}
            {!showStatsPanel && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowStatsPanel(true)}
                className="bg-background/95 backdrop-blur"
              >
                <Info className="h-4 w-4 mr-1" />
                {t('map_stats')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Selected Cell Info */}
      {selectedCell && (
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Grid3X3 className="h-4 w-4" />
                {t('qgmap_selected_cell')}
              </h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedCell(null)}>
              ×
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">{t('qgmap_afroloc_code')}</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="font-mono text-sm font-medium bg-muted px-2 py-1 rounded">
                  {selectedCell.qg.afroloc || selectedCell.qg.qgCode}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => copyCode(selectedCell.qg.afroloc || selectedCell.qg.qgCode || '')}
                >
                  {copiedCode === (selectedCell.qg.afroloc || selectedCell.qg.qgCode) ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('qgmap_zone_type')}</p>
              <Badge variant={(selectedCell.qg.zone || selectedCell.qg.cellType) === 'urban' ? 'default' : 'secondary'}>
                {(selectedCell.qg.zone || selectedCell.qg.cellType) === 'urban' ? t('qgmap_urban') : t('qgmap_rural')}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('qgmap_cell_size')}</p>
              <p className="text-sm font-medium">{selectedCell.qg.grid_m || selectedCell.qg.cellSize}m</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('qgmap_grid_index')}</p>
              <p className="text-sm font-medium">
                ({selectedCell.qg.tile_ix || selectedCell.qg.cellX}, {selectedCell.qg.tile_iy || selectedCell.qg.cellY})
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('qgmap_centroid')}</p>
              <p className="text-sm font-medium">
                {selectedCell.qg.centroid
                  ? `${selectedCell.qg.centroid.lat.toFixed(6)}, ${selectedCell.qg.centroid.lon.toFixed(6)}`
                  : t('qgmap_na')}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('qgmap_records_in_cell')}</p>
              <Badge 
                variant={
                  (() => {
                    const code = selectedCell.qg.afroloc || selectedCell.qg.qgCode || '';
                    const count = cellDensity.get(code)?.count || 0;
                    const densityLevel = getDensityColor(count, maxDensity).level;
                    return densityLevel === 'very-high' || densityLevel === 'high' ? 'destructive' :
                           densityLevel === 'medium' ? 'default' : 'secondary';
                  })()
                }
              >
                {cellDensity.get(selectedCell.qg.afroloc || selectedCell.qg.qgCode || '')?.count || 0} {t('qgmap_certifications_lc')}
              </Badge>
            </div>

            {selectedCell.sq && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">{t('qgmap_full_code')}</p>
                  <p className="font-mono text-sm font-medium">{selectedCell.sq.fullCode}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('qgmap_subdivision')}</p>
                  <Badge variant="outline">{selectedCell.sq.subdivisionType}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('qgmap_density')}</p>
                  <Badge 
                    variant={
                      selectedCell.sq.densityMetrics.densityClass === 'high' ? 'destructive' :
                      selectedCell.sq.densityMetrics.densityClass === 'medium' ? 'default' : 'secondary'
                    }
                  >
                    {selectedCell.sq.densityMetrics.densityClass}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('qgmap_certifications')}</p>
                  <p className="text-sm font-medium">{selectedCell.sq.densityMetrics.certificationCount}</p>
                </div>
              </>
            )}
          </div>

          {/* Time-series density trend chart */}
          <CellDensityTrendChart 
            records={cellDensity.get(selectedCell.qg.afroloc || selectedCell.qg.qgCode || '')?.records || []}
            cellCode={selectedCell.qg.afroloc || selectedCell.qg.qgCode || ''}
          />
        </Card>
      )}

      {/* Selected Tower Info */}
      {selectedTower && (
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Radio className="h-4 w-4 text-violet-500" />
                {t('qgmap_selected_tower')}
              </h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedTower(null)}>
              ×
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('qgmap_name')}</p>
              <p className="text-sm font-medium">{selectedTower.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('qgmap_operator')}</p>
              <p className="text-sm font-medium">{selectedTower.operator}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('qgmap_technology')}</p>
              <Badge 
                style={{ 
                  backgroundColor: GRID_COLORS.tower[selectedTower.type].fill,
                  borderColor: GRID_COLORS.tower[selectedTower.type].stroke,
                  color: GRID_COLORS.tower[selectedTower.type].marker
                }}
              >
                {selectedTower.type}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('qgmap_cell_id')}</p>
              <p className="font-mono text-sm font-medium">{selectedTower.cellId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('qgmap_coverage_radius')}</p>
              <p className="text-sm font-medium">{(selectedTower.coverageRadius / 1000).toFixed(1)} km</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('qgmap_signal_strength')}</p>
              <Badge 
                variant={
                  selectedTower.signalStrength === 'excellent' ? 'default' :
                  selectedTower.signalStrength === 'good' ? 'secondary' :
                  selectedTower.signalStrength === 'fair' ? 'outline' : 'destructive'
                }
              >
                <Signal className="h-3 w-3 mr-1" />
                {selectedTower.signalStrength}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">RSRP</p>
              <p className="text-sm font-medium">{selectedTower.rsrp?.toFixed(1)} dBm</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('qgmap_coordinates')}</p>
              <p className="text-sm font-medium">{selectedTower.lat.toFixed(4)}, {selectedTower.lon.toFixed(4)}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Comparison Panel */}
      {comparisonMode && comparisonCells.length > 0 && (
        <CellComparisonPanel
          comparisonCells={comparisonCells}
          cellDensity={cellDensity}
          onRemoveCell={removeCellFromComparison}
          onClearAll={clearComparison}
        />
      )}

      {/* Click-to-Create AFROLOC Proposal Modal */}
      <ClickProposalModal
        clickProposal={clickProposal}
        setClickProposal={setClickProposal}
        setHighlightedCellCode={setHighlightedCellCode}
        pulsingMarkerRef={pulsingMarkerRef}
        copiedCode={copiedCode}
        copyCode={copyCode}
        countryCode={countryCode}
      />

      {/* Comparison Mode Instructions */}
      {comparisonMode && comparisonCells.length === 0 && (
        <Card className="p-4 border-dashed border-2 border-muted-foreground/30">
          <div className="text-center text-muted-foreground">
            <GitCompare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">{t('qgmap_comparison_mode_active')}</p>
            <p className="text-xs">{t('qgmap_comparison_instructions')}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
