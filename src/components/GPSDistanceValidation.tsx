import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { GPSValidationResult } from '@/utils/gpsDistance';

interface GPSDistanceValidationProps {
  validation: GPSValidationResult | null;
  onConfirm?: () => void;
  onCancel?: () => void;
  showActions?: boolean;
}

export function GPSDistanceValidation({
  validation,
  onConfirm,
  onCancel,
  showActions = false,
}: GPSDistanceValidationProps) {
  if (!validation) return null;

  const getIcon = () => {
    switch (validation.severity) {
      case 'ok':
        return <CheckCircle className="h-4 w-4" />;
      case 'warning':
        return <Info className="h-4 w-4" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4" />;
      case 'suspicious':
        return <XCircle className="h-4 w-4" />;
    }
  };

  const getVariant = () => {
    switch (validation.severity) {
      case 'ok':
        return 'default' as const;
      case 'warning':
        return 'default' as const;
      case 'error':
      case 'suspicious':
        return 'destructive' as const;
    }
  };

  const getTitle = () => {
    switch (validation.severity) {
      case 'ok':
        return 'Localização Confirmada';
      case 'warning':
        return 'Verificação de Localização';
      case 'error':
        return 'Confirmação Necessária';
      case 'suspicious':
        return 'Localização Não Confirmada';
    }
  };

  return (
    <Alert variant={getVariant()} className="mt-4">
      {getIcon()}
      <AlertTitle>{getTitle()}</AlertTitle>
      <AlertDescription className="mt-2">
        <p>{validation.message}</p>
        
        {showActions && !validation.isValid && (
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onConfirm}
            >
              Confirmar Mesmo Assim
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
