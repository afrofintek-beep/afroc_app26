import { useCallback, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Plus, X, Copy, Check, Info, CheckCircle, Home, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuthorizationLevel, LEVEL_NAMES, hasMinimumLevel } from '@/hooks/useAuthorizationLevel';
import type { QGResult } from '@/hooks/useQGSQEngine';
import mapboxgl from 'mapbox-gl';

// Minimum authorization level required for DIRECT validation (auto-approve)
const MIN_LEVEL_AUTO_APPROVE = 3; // Level 3+ can auto-approve their own creations

// Address types: Formal or Informal - both become Digital when assigned AFROLOC code
type AddressCategory = 'formal' | 'informal';

const ADDRESS_CATEGORIES = {
  formal: {
    label: 'Formal',
    description: 'Rua com nome e número → Digital com AFROLOC',
    icon: Home,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
    borderColor: 'border-green-200'
  },
  informal: {
    label: 'Informal',
    description: 'Sem rua/número → Digital com AFROLOC',
    icon: MapPin,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/20',
    borderColor: 'border-amber-200'
  }
};

interface ClickProposalModalProps {
  clickProposal: {
    lat: number;
    lon: number;
    qgResult: QGResult | null;
    isLoading: boolean;
  } | null;
  setClickProposal: (proposal: null) => void;
  setHighlightedCellCode: (code: string | null) => void;
  pulsingMarkerRef: React.MutableRefObject<mapboxgl.Marker | null>;
  copiedCode: string | null;
  copyCode: (code: string) => void;
  countryCode?: string;
}

export function ClickProposalModal({
  clickProposal,
  setClickProposal,
  setHighlightedCellCode,
  pulsingMarkerRef,
  copiedCode,
  copyCode,
  countryCode
}: ClickProposalModalProps) {
  const { data: authLevel, isLoading: authLoading } = useAuthorizationLevel();
  const [isCreating, setIsCreating] = useState(false);
  const [addressCategory, setAddressCategory] = useState<AddressCategory>('informal');
  const [streetName, setStreetName] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  
  const userLevel = authLevel?.current_level ?? 1;
  const canAutoApprove = hasMinimumLevel(userLevel, MIN_LEVEL_AUTO_APPROVE);
  const levelName = LEVEL_NAMES[userLevel as keyof typeof LEVEL_NAMES] || 'Basic';
  
  // For formal addresses, street name and number are required
  const isFormalValid = addressCategory !== 'formal' || (streetName.trim() !== '' && houseNumber.trim() !== '');
  
  // Close modal helper
  const closeModal = useCallback(() => {
    setClickProposal(null);
    setHighlightedCellCode(null);
    setStreetName('');
    setHouseNumber('');
    setAddressCategory('informal');
    if (pulsingMarkerRef.current) {
      pulsingMarkerRef.current.remove();
      pulsingMarkerRef.current = null;
    }
  }, [setClickProposal, setHighlightedCellCode, pulsingMarkerRef]);
  
  // Create AFROLOC record directly
  const handleCreateRecord = useCallback(async () => {
    if (!clickProposal?.qgResult) return;
    
    if (!isFormalValid) {
      toast.error('Para endereços formais, preencha a rua e o número');
      return;
    }
    
    setIsCreating(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Sessão expirada. Por favor, faça login novamente.');
        return;
      }
      
      const code = clickProposal.qgResult.afroloc || clickProposal.qgResult.qgCode || '';
      const zone = clickProposal.qgResult.zone || clickProposal.qgResult.cellType;
      
      // Both formal and informal become "digital" addresses when they get an AFROLOC code
      // The address_type field stores whether it was originally formal or informal
      
      // Insert the AFROLOC record
      // Status: Level 3+ = approved, Level 1-2 = pending_validation (awaiting validator review)
      const { error: insertError } = await supabase.from('afroloc_records').insert({
        code,
        country: countryCode || 'AO',
        geo_lat: clickProposal.lat,
        geo_lon: clickProposal.lon,
        user_id: user.id,
        registered_by_user_id: user.id,
        status: canAutoApprove ? 'approved' : 'pending_validation',
        address_type: addressCategory, // 'formal' or 'informal' - both are now digital addresses
        property_type: 'residential',
        // Add street and number for formal addresses
        ...(addressCategory === 'formal' && {
          street_name: streetName.trim(),
          number: houseNumber.trim()
        }),
        ...(canAutoApprove && {
          approved_at: new Date().toISOString(),
          approved_by_user_id: user.id
        }),
        metadata: {
          created_from: 'map_click',
          zone_type: zone,
          cell_size: clickProposal.qgResult.grid_m || clickProposal.qgResult.cellSize,
          address_category: addressCategory,
          created_at: new Date().toISOString()
        }
      });
      
      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }
      
      // Log to security audit
      await supabase.from('security_audit_log').insert({
        user_id: user.id,
        action: canAutoApprove ? 'AFROLOC_CREATED_APPROVED' : 'AFROLOC_CREATED_PENDING',
        function_name: 'map_click_create',
        details: {
          afroloc_code: code,
          coordinates: { lat: clickProposal.lat, lon: clickProposal.lon },
          zone_type: zone,
          cell_size: clickProposal.qgResult.grid_m || clickProposal.qgResult.cellSize,
          country: countryCode,
          user_level: userLevel,
          address_category: addressCategory,
          street_name: addressCategory === 'formal' ? streetName : null,
          house_number: addressCategory === 'formal' ? houseNumber : null,
          auto_approved: canAutoApprove
        }
      });
      
      const categoryLabel = ADDRESS_CATEGORIES[addressCategory].label;
      
      if (canAutoApprove) {
        toast.success(`AFROLOC ${categoryLabel} criado e aprovado!`, {
          description: `Código: ${code}`
        });
      } else {
        toast.success(`AFROLOC ${categoryLabel} criado com sucesso!`, {
          description: 'Aguardando validação por um operador autorizado.'
        });
      }
      
      closeModal();
      
    } catch (err) {
      console.error('Error creating AFROLOC:', err);
      const errorMessage = err instanceof Error ? err.message : '';
      
      // Check for specific error about user limit
      if (errorMessage.includes('Maximum limit') && errorMessage.includes('AFROLOC addresses')) {
        toast.error('Limite de endereços atingido', {
          description: 'Você já possui o máximo de 10 endereços AFROLOC permitidos. Para adicionar novos endereços, elimine um dos existentes primeiro.',
          duration: 6000
        });
      } else {
        toast.error('Erro ao criar AFROLOC', {
          description: errorMessage || 'Tente novamente'
        });
      }
    } finally {
      setIsCreating(false);
    }
  }, [clickProposal, countryCode, userLevel, canAutoApprove, closeModal, addressCategory, streetName, houseNumber, isFormalValid]);
  
  if (!clickProposal) return null;
  
  return (
    <Card className="absolute bottom-4 left-1/2 -translate-x-1/2 p-4 z-30 shadow-2xl border-2 border-primary/20 w-[400px] max-w-[95vw] bg-background/95 backdrop-blur-sm max-h-[85vh] overflow-y-auto">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Criar AFROLOC</h3>
            <p className="text-xs text-muted-foreground">
              {canAutoApprove ? 'Aprovação automática' : 'Sujeito a validação'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={closeModal}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Info about validation */}
      {!canAutoApprove && !authLoading && (
        <Alert className="mb-3 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
            O seu AFROLOC será criado e enviado para validação por um operador de nível 3 ou superior.
          </AlertDescription>
        </Alert>
      )}
      
      {canAutoApprove && !authLoading && (
        <Alert className="mb-3 border-green-200 bg-green-50 dark:bg-green-950/20">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-xs text-green-800 dark:text-green-200">
            Como operador nível {userLevel}, o seu AFROLOC será aprovado automaticamente.
          </AlertDescription>
        </Alert>
      )}
      
      {clickProposal.isLoading || authLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            {authLoading ? 'Verificando autorização...' : 'Calculando código...'}
          </span>
        </div>
      ) : clickProposal.qgResult ? (
        <div className="space-y-3">
          {/* Address Type Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Tipo de Endereço</Label>
            <RadioGroup
              value={addressCategory}
              onValueChange={(v) => setAddressCategory(v as AddressCategory)}
              className="grid grid-cols-2 gap-2"
            >
              {(Object.entries(ADDRESS_CATEGORIES) as [AddressCategory, typeof ADDRESS_CATEGORIES.formal][]).map(([key, config]) => {
                const Icon = config.icon;
                const isSelected = addressCategory === key;
                return (
                  <Label
                    key={key}
                    htmlFor={`addr-${key}`}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected 
                        ? `${config.borderColor} ${config.bgColor}` 
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <RadioGroupItem value={key} id={`addr-${key}`} className="sr-only" />
                    <Icon className={`h-5 w-5 ${isSelected ? config.color : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-medium ${isSelected ? config.color : 'text-muted-foreground'}`}>
                      {config.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">
                      {config.description}
                    </span>
                  </Label>
                );
              })}
            </RadioGroup>
          </div>
          
          {/* Street Name and Number for Formal Addresses */}
          {addressCategory === 'formal' && (
            <div className="space-y-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="streetName" className="text-xs">Nome da Rua *</Label>
                  <Input
                    id="streetName"
                    placeholder="Ex: Av. 4 de Fevereiro"
                    value={streetName}
                    onChange={(e) => setStreetName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="houseNumber" className="text-xs">Número *</Label>
                  <Input
                    id="houseNumber"
                    placeholder="Ex: 123"
                    value={houseNumber}
                    onChange={(e) => setHouseNumber(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                * Campos obrigatórios para endereços formais
              </p>
            </div>
          )}
          
          {/* AFROLOC Code */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Código AFROLOC Digital</p>
            <div className="flex items-center gap-2">
              <code className="font-mono text-sm font-bold text-primary flex-1 break-all">
                {clickProposal.qgResult.afroloc || clickProposal.qgResult.qgCode}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => copyCode(clickProposal.qgResult?.afroloc || clickProposal.qgResult?.qgCode || '')}
              >
                {copiedCode === (clickProposal.qgResult.afroloc || clickProposal.qgResult.qgCode) ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
          
          {/* Coordinates and Cell Info */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="bg-muted/30 rounded p-2">
              <p className="text-muted-foreground">Lat</p>
              <p className="font-mono font-medium text-[11px]">{clickProposal.lat.toFixed(5)}</p>
            </div>
            <div className="bg-muted/30 rounded p-2">
              <p className="text-muted-foreground">Lon</p>
              <p className="font-mono font-medium text-[11px]">{clickProposal.lon.toFixed(5)}</p>
            </div>
            <div className="bg-muted/30 rounded p-2">
              <p className="text-muted-foreground">Zona</p>
              <Badge variant="outline" className="mt-0.5 text-[10px] px-1">
                {(clickProposal.qgResult.zone || clickProposal.qgResult.cellType) === 'urban' ? 'Urbana' : 'Rural'}
              </Badge>
            </div>
            <div className="bg-muted/30 rounded p-2">
              <p className="text-muted-foreground">Célula</p>
              <p className="font-medium mt-0.5">{clickProposal.qgResult.grid_m || clickProposal.qgResult.cellSize || 10}m</p>
            </div>
          </div>
          
          {/* User Level Info */}
          <div className="bg-muted/30 rounded p-2 text-xs">
            <p className="text-muted-foreground">Seu Nível</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge 
                variant={canAutoApprove ? 'default' : 'secondary'}
                className={canAutoApprove ? 'bg-green-600' : ''}
              >
                Nível {userLevel} - {levelName}
              </Badge>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={closeModal}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreateRecord}
              disabled={isCreating || !isFormalValid}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  {canAutoApprove ? 'Criar e Aprovar' : 'Criar AFROLOC'}
                </>
              )}
            </Button>
          </div>
          
          {/* Info note */}
          <p className="text-xs text-muted-foreground text-center pt-1">
            Clique no mapa para selecionar outro local
          </p>
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-sm">Erro ao calcular código</p>
        </div>
      )}
    </Card>
  );
}