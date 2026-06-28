import { useState, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Map, 
  MapPin, 
  Globe, 
  Crosshair, 
  Loader2, 
  Square, 
  Download, 
  Copy, 
  Check,
  Navigation,
  Info,
  Shield,
  ShieldAlert,
  Lock,
  AlertTriangle,
  Ban
} from 'lucide-react';
import { toast } from 'sonner';
import { useQGSQEngine, QGResult } from '@/hooks/useQGSQEngine';
import { supabase } from '@/integrations/supabase/client';
import { useAuthorizationLevel, LEVEL_NAMES } from '@/hooks/useAuthorizationLevel';

interface CreationPermission {
  allowed: boolean;
  auto_approved?: boolean;
  requires_approval?: boolean;
  reason?: string;
  required_level?: number;
  user_level?: number;
  zone_name?: string;
  zone_type?: string;
  max_per_batch?: number;
  max_per_day?: number;
  used_today?: number;
  requested?: number;
}

interface ProtectedZone {
  id: string;
  name: string;
  zone_type: string;
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
}

interface GridCellCreatorProps {
  countryCode: string;
  onCellsGenerated?: (cells: QGResult[]) => void;
  onCellSelected?: (cell: QGResult) => void;
  mapBounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
}

interface AdminDivision {
  id: string;
  code: string;
  name: string;
  level: number;
  country_code: string;
}

export default function GridCellCreator({ 
  countryCode, 
  onCellsGenerated, 
  onCellSelected,
  mapBounds 
}: GridCellCreatorProps) {
  const { computeQG, loading } = useQGSQEngine();
  const { data: authLevel, isLoading: isLoadingAuth } = useAuthorizationLevel();
  const userLevel = authLevel?.current_level || 1;
  
  // Tab state
  const [activeTab, setActiveTab] = useState('map');
  
  // Permission state
  const [permission, setPermission] = useState<CreationPermission | null>(null);
  const [protectedZones, setProtectedZones] = useState<ProtectedZone[]>([]);
  const [checkingPermission, setCheckingPermission] = useState(false);
  
  // Map selection state
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  
  // GPS coordinates input
  const [gpsLat, setGpsLat] = useState('');
  const [gpsLon, setGpsLon] = useState('');
  const [gpsMinLat, setGpsMinLat] = useState('');
  const [gpsMaxLat, setGpsMaxLat] = useState('');
  const [gpsMinLon, setGpsMinLon] = useState('');
  const [gpsMaxLon, setGpsMaxLon] = useState('');
  
  // Administrative division state
  const [divisions, setDivisions] = useState<AdminDivision[]>([]);
  const [selectedLevel1, setSelectedLevel1] = useState('');
  const [selectedLevel2, setSelectedLevel2] = useState('');
  const [level2Divisions, setLevel2Divisions] = useState<AdminDivision[]>([]);
  const [loadingDivisions, setLoadingDivisions] = useState(false);
  
  // Point-by-point state
  const [pointLat, setPointLat] = useState('');
  const [pointLon, setPointLon] = useState('');
  const [pointCells, setPointCells] = useState<QGResult[]>([]);
  
  // Generated cells (temporary, not persisted until property registration)
  const [generatedCells, setGeneratedCells] = useState<QGResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Check creation permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      setCheckingPermission(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data, error } = await supabase.rpc('check_cell_creation_allowed', {
          p_user_id: user.id,
          p_country_code: countryCode,
          p_level1_code: authLevel?.jurisdiction_level1_code || null,
          p_cell_count: 1
        });
        
        if (!error && data) {
          setPermission(data as unknown as CreationPermission);
        }
      } catch (err) {
        console.error('Error checking permission:', err);
      } finally {
        setCheckingPermission(false);
      }
    };
    
    checkPermission();
  }, [countryCode, authLevel]);

  // Fetch protected zones
  useEffect(() => {
    const fetchProtectedZones = async () => {
      try {
        const { data, error } = await supabase
          .from('cadastral_protected_zones')
          .select('id, name, zone_type, min_lat, max_lat, min_lon, max_lon')
          .eq('country_code', countryCode)
          .eq('is_active', true)
          .eq('creation_blocked', true);
        
        if (!error && data) {
          setProtectedZones(data);
        }
      } catch (err) {
        console.error('Error fetching protected zones:', err);
      }
    };
    
    fetchProtectedZones();
  }, [countryCode]);

  // Check if a point is in a protected zone
  const isInProtectedZone = useCallback((lat: number, lon: number): ProtectedZone | null => {
    for (const zone of protectedZones) {
      if (lat >= zone.min_lat && lat <= zone.max_lat && 
          lon >= zone.min_lon && lon <= zone.max_lon) {
        return zone;
      }
    }
    return null;
  }, [protectedZones]);

  // Fetch level 1 divisions on mount
  const fetchDivisions = useCallback(async () => {
    setLoadingDivisions(true);
    try {
      const { data, error } = await supabase
        .from('administrative_divisions')
        .select('*')
        .eq('country_code', countryCode)
        .eq('level', 1)
        .order('name');
      
      if (error) throw error;
      setDivisions(data || []);
    } catch (err) {
      console.error('Error fetching divisions:', err);
    } finally {
      setLoadingDivisions(false);
    }
  }, [countryCode]);

  // Fetch level 2 divisions when level 1 is selected
  const handleLevel1Change = async (code: string) => {
    setSelectedLevel1(code);
    setSelectedLevel2('');
    
    if (!code) {
      setLevel2Divisions([]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('administrative_divisions')
        .select('*')
        .eq('country_code', countryCode)
        .eq('parent_code', code)
        .eq('level', 2)
        .order('name');
      
      if (error) throw error;
      setLevel2Divisions(data || []);
    } catch (err) {
      console.error('Error fetching level 2 divisions:', err);
    }
  };

  // Generate cell from single point with permission check
  const handlePointGenerate = async () => {
    const lat = parseFloat(pointLat);
    const lon = parseFloat(pointLon);
    
    if (isNaN(lat) || isNaN(lon)) {
      toast.error('Coordenadas inválidas');
      return;
    }
    
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      toast.error('Coordenadas fora do intervalo válido');
      return;
    }
    
    // Check if in protected zone
    const protectedZone = isInProtectedZone(lat, lon);
    if (protectedZone) {
      toast.error(`Zona protegida: ${protectedZone.name}`, {
        description: `Tipo: ${protectedZone.zone_type} - Criação bloqueada`
      });
      return;
    }
    
    // Check permission
    if (permission && !permission.allowed) {
      toast.error('Sem permissão para criar células', {
        description: permission.reason === 'authorization_level_insufficient' 
          ? `Nível ${permission.required_level} necessário`
          : permission.reason
      });
      return;
    }
    
    setIsGenerating(true);
    try {
      const cell = await computeQG(lat, lon, countryCode);
      if (cell) {
        const newCells = [...pointCells, cell];
        setPointCells(newCells);
        setGeneratedCells(prev => {
          const existing = new Set(prev.map(c => c.afroloc || c.qgCode));
          if (!existing.has(cell.afroloc || cell.qgCode)) {
            return [...prev, cell];
          }
          return prev;
        });
        onCellSelected?.(cell);
        
        const statusMsg = permission?.auto_approved 
          ? '(auto-aprovada)' 
          : permission?.requires_approval 
            ? '(pendente aprovação)' 
            : '';
        toast.success(`Célula ${cell.afroloc} gerada ${statusMsg}`);
        setPointLat('');
        setPointLon('');
      }
    } catch (err) {
      toast.error('Erro ao gerar célula');
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate cells from GPS bounds
  const handleGpsBoundsGenerate = async () => {
    const minLat = parseFloat(gpsMinLat);
    const maxLat = parseFloat(gpsMaxLat);
    const minLon = parseFloat(gpsMinLon);
    const maxLon = parseFloat(gpsMaxLon);
    
    if ([minLat, maxLat, minLon, maxLon].some(isNaN)) {
      toast.error('Todas as coordenadas são obrigatórias');
      return;
    }
    
    if (minLat >= maxLat || minLon >= maxLon) {
      toast.error('Limites inválidos (min deve ser menor que max)');
      return;
    }
    
    await generateCellsForBounds({ minLat, maxLat, minLon, maxLon });
  };

  // Generate cells for given bounds
  const generateCellsForBounds = async (bounds: { 
    minLat: number; 
    maxLat: number; 
    minLon: number; 
    maxLon: number 
  }) => {
    setIsGenerating(true);
    const cells: QGResult[] = [];
    const seenCodes = new Set<string>();
    
    try {
      // Calculate grid density based on area size
      const latRange = bounds.maxLat - bounds.minLat;
      const lonRange = bounds.maxLon - bounds.minLon;
      const areaSqDeg = latRange * lonRange;
      
      // Limit cells for performance
      const gridDensity = Math.min(15, Math.max(5, Math.floor(100 / Math.sqrt(areaSqDeg * 10000))));
      
      const latStep = latRange / gridDensity;
      const lonStep = lonRange / gridDensity;
      
      for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += latStep) {
        for (let lon = bounds.minLon; lon <= bounds.maxLon; lon += lonStep) {
          const cell = await computeQG(lat, lon, countryCode);
          const code = cell?.afroloc || cell?.qgCode;
          if (cell && code && !seenCodes.has(code)) {
            seenCodes.add(code);
            cells.push(cell);
          }
        }
      }
      
      setGeneratedCells(prev => {
        const existing = new Set(prev.map(c => c.afroloc || c.qgCode));
        const newCells = cells.filter(c => !existing.has(c.afroloc || c.qgCode));
        return [...prev, ...newCells];
      });
      
      onCellsGenerated?.(cells);
      toast.success(`${cells.length} células geradas (temporárias)`);
    } catch (err) {
      toast.error('Erro ao gerar células');
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate cells for selected administrative division
  const handleAdminDivisionGenerate = async () => {
    if (!selectedLevel1) {
      toast.error('Selecione pelo menos uma província');
      return;
    }
    
    // For now, we'll generate sample cells around known centers
    // In production, this would use actual boundary data
    const divisionCenters: Record<string, { lat: number; lon: number; radius: number }> = {
      'LDA': { lat: -8.8383, lon: 13.2344, radius: 0.05 },
      'BGO': { lat: -12.5763, lon: 13.4055, radius: 0.08 },
      'HUI': { lat: -12.7871, lon: 15.7334, radius: 0.08 },
      'BIE': { lat: -12.3811, lon: 17.6672, radius: 0.1 },
    };
    
    const divCode = selectedLevel2 || selectedLevel1;
    const center = divisionCenters[selectedLevel1] || { lat: -8.8383, lon: 13.2344, radius: 0.05 };
    
    await generateCellsForBounds({
      minLat: center.lat - center.radius,
      maxLat: center.lat + center.radius,
      minLon: center.lon - center.radius,
      maxLon: center.lon + center.radius,
    });
  };

  // Copy code to clipboard
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Código copiado');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Export cells to CSV
  const exportToCSV = () => {
    if (generatedCells.length === 0) {
      toast.error('Nenhuma célula para exportar');
      return;
    }
    
    const headers = ['AFROLOC', 'Tipo', 'Tamanho_m', 'Lat_Centro', 'Lon_Centro', 'MinLat', 'MaxLat', 'MinLon', 'MaxLon'];
    const rows = generatedCells.map(cell => {
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
    link.download = `afroloc-cells-${countryCode}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success('CSV exportado');
  };

  // Clear generated cells
  const clearCells = () => {
    setGeneratedCells([]);
    setPointCells([]);
    toast.info('Células temporárias limpas');
  };

  // Permission denied state
  const isBlocked = permission && !permission.allowed;
  const reasonLabel: Record<string, string> = {
    'authorization_level_insufficient': 'Nível de autorização insuficiente',
    'protected_zone': 'Zona protegida',
    'batch_limit_exceeded': 'Limite de lote excedido',
    'daily_limit_exceeded': 'Limite diário excedido',
    'monthly_limit_exceeded': 'Limite mensal excedido',
  };

  return (
    <Card className="p-4">
      {/* Permission Status Banner */}
      {checkingPermission ? (
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Verificando permissões...</span>
        </div>
      ) : isBlocked ? (
        <Alert className="mb-4 border-red-200 bg-red-50 dark:bg-red-950">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            <strong>Criação de células bloqueada:</strong>{' '}
            {reasonLabel[permission?.reason || ''] || permission?.reason}
            {permission?.required_level && (
              <span className="ml-1">
                (Nível {permission.required_level} necessário, você tem Nível {permission.user_level})
              </span>
            )}
          </AlertDescription>
        </Alert>
      ) : permission?.allowed && (
        <Alert className="mb-4 border-green-200 bg-green-50 dark:bg-green-950">
          <Shield className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              <strong>Autorizado:</strong> Nível {userLevel} ({LEVEL_NAMES[userLevel as keyof typeof LEVEL_NAMES] || 'Básico'})
              {permission.auto_approved && <Badge variant="default" className="ml-2 bg-green-500">Auto-aprovado</Badge>}
              {permission.requires_approval && <Badge variant="secondary" className="ml-2">Requer aprovação</Badge>}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Protected Zones Warning */}
      {protectedZones.length > 0 && (
        <Alert className="mb-4 border-amber-200 bg-amber-50 dark:bg-amber-950">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>{protectedZones.length} zona(s) protegida(s)</strong> nesta região: 
            {protectedZones.slice(0, 3).map(z => z.name).join(', ')}
            {protectedZones.length > 3 && ` +${protectedZones.length - 3} mais`}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Square className="h-4 w-4 text-primary" />
            Criar Células de Grelha
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Células são temporárias até serem associadas a uma propriedade
          </p>
        </div>
        {generatedCells.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">{generatedCells.length} células</Badge>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-3 w-3 mr-1" />
              CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={clearCells}>
              Limpar
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="map" className="flex items-center gap-1.5">
            <Map className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mapa</span>
          </TabsTrigger>
          <TabsTrigger value="gps" className="flex items-center gap-1.5">
            <Navigation className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">GPS</span>
          </TabsTrigger>
          <TabsTrigger value="admin" className="flex items-center gap-1.5" onClick={fetchDivisions}>
            <Globe className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Divisão</span>
          </TabsTrigger>
          <TabsTrigger value="point" className="flex items-center gap-1.5">
            <Crosshair className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ponto</span>
          </TabsTrigger>
        </TabsList>

        {/* Map Selection Tab */}
        <TabsContent value="map" className="mt-4">
          <Alert>
            <Map className="h-4 w-4" />
            <AlertDescription>
              <strong>Seleção no Mapa:</strong> Desenhe um retângulo no mapa para gerar todas as células dentro da área.
            </AlertDescription>
          </Alert>
          
          {mapBounds && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 p-2 rounded">
                  <span className="text-muted-foreground">Lat:</span>{' '}
                  {mapBounds.minLat.toFixed(4)} → {mapBounds.maxLat.toFixed(4)}
                </div>
                <div className="bg-muted/50 p-2 rounded">
                  <span className="text-muted-foreground">Lon:</span>{' '}
                  {mapBounds.minLon.toFixed(4)} → {mapBounds.maxLon.toFixed(4)}
                </div>
              </div>
              <Button 
                className="w-full" 
                onClick={() => generateCellsForBounds(mapBounds)}
                disabled={isGenerating || isBlocked}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                Gerar Células para Área Visível
              </Button>
            </div>
          )}
          
          {!mapBounds && (
            <p className="text-sm text-muted-foreground mt-4">
              Use o botão "Gerar Lote" no painel de controlo do mapa para selecionar a área visível.
            </p>
          )}
        </TabsContent>

        {/* GPS Coordinates Tab */}
        <TabsContent value="gps" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Latitude Mínima</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="-8.9000"
                value={gpsMinLat}
                onChange={(e) => setGpsMinLat(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Latitude Máxima</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="-8.8000"
                value={gpsMaxLat}
                onChange={(e) => setGpsMaxLat(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Longitude Mínima</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="13.2000"
                value={gpsMinLon}
                onChange={(e) => setGpsMinLon(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Longitude Máxima</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="13.3000"
                value={gpsMaxLon}
                onChange={(e) => setGpsMaxLon(e.target.value)}
              />
            </div>
          </div>
          <Button 
            className="w-full" 
            onClick={handleGpsBoundsGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4 mr-2" />
            )}
            Gerar Células por Coordenadas
          </Button>
        </TabsContent>

        {/* Administrative Division Tab */}
        <TabsContent value="admin" className="mt-4 space-y-4">
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Província (Nível 1)</Label>
              <Select value={selectedLevel1} onValueChange={handleLevel1Change}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar província..." />
                </SelectTrigger>
                <SelectContent>
                  {divisions.map((div) => (
                    <SelectItem key={div.id} value={div.code}>
                      {div.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {level2Divisions.length > 0 && (
              <div>
                <Label className="text-xs">Município (Nível 2)</Label>
                <Select value={selectedLevel2} onValueChange={setSelectedLevel2}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional - Selecionar município..." />
                  </SelectTrigger>
                  <SelectContent>
                    {level2Divisions.map((div) => (
                      <SelectItem key={div.id} value={div.code}>
                        {div.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <Button 
            className="w-full" 
            onClick={handleAdminDivisionGenerate}
            disabled={isGenerating || !selectedLevel1}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Globe className="h-4 w-4 mr-2" />
            )}
            Gerar Células para Divisão
          </Button>
          
          <p className="text-xs text-muted-foreground">
            <Info className="h-3 w-3 inline mr-1" />
            Gera células para a área aproximada da divisão administrativa selecionada.
          </p>
        </TabsContent>

        {/* Point-by-Point Tab */}
        <TabsContent value="point" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Latitude</Label>
              <Input
                type="number"
                step="0.000001"
                placeholder="-8.8383"
                value={pointLat}
                onChange={(e) => setPointLat(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Longitude</Label>
              <Input
                type="number"
                step="0.000001"
                placeholder="13.2344"
                value={pointLon}
                onChange={(e) => setPointLon(e.target.value)}
              />
            </div>
          </div>
          
          <Button 
            className="w-full" 
            onClick={handlePointGenerate}
            disabled={isGenerating || loading}
          >
            {isGenerating || loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Crosshair className="h-4 w-4 mr-2" />
            )}
            Adicionar Célula
          </Button>
          
          {pointCells.length > 0 && (
            <div className="border rounded p-2 max-h-32 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-2">
                {pointCells.length} célula(s) adicionada(s):
              </p>
              <div className="space-y-1">
                {pointCells.map((cell, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-muted/50 p-1.5 rounded text-xs">
                    <code className="font-mono">{cell.afroloc || cell.qgCode}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
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
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Generated Cells Summary */}
      {generatedCells.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Células Geradas (Temporárias)</h4>
            <Badge variant="secondary">
              {generatedCells.filter(c => (c.zone || c.cellType) === 'urban').length} urbanas,{' '}
              {generatedCells.filter(c => (c.zone || c.cellType) === 'rural').length} rurais
            </Badge>
          </div>
          <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Estas células são <strong>temporárias</strong> e só serão persistidas na base de dados quando uma propriedade for registada com a célula associada.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </Card>
  );
}
