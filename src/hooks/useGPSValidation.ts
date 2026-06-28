import { useToast } from '@/hooks/use-toast';

export interface GPSValidationResult {
  isValid: boolean;
  error?: string;
}

// Predefined geographic bounds for African countries
// Format: [min_lat, max_lat, min_lon, max_lon]
const COUNTRY_BOUNDS: Record<string, { bounds: [number, number, number, number]; name: string }> = {
  AO: { bounds: [-18.0, -4.5, 11.5, 24.1], name: 'Angola' },
  DZ: { bounds: [18.9, 37.1, -9.0, 12.0], name: 'Argélia' },
  BJ: { bounds: [6.2, 12.5, 0.8, 3.9], name: 'Benin' },
  BW: { bounds: [-27.0, -17.8, 19.9, 29.4], name: 'Botsuana' },
  BF: { bounds: [9.4, 15.1, -5.5, 2.4], name: 'Burkina Faso' },
  BI: { bounds: [-4.5, -2.3, 28.9, 30.9], name: 'Burundi' },
  CM: { bounds: [1.6, 13.1, 8.5, 16.2], name: 'Camarões' },
  CV: { bounds: [14.8, 17.2, -25.4, -22.6], name: 'Cabo Verde' },
  CF: { bounds: [2.2, 11.0, 14.4, 27.5], name: 'República Centro-Africana' },
  TD: { bounds: [7.4, 23.5, 13.5, 24.0], name: 'Chade' },
  KM: { bounds: [-12.5, -11.3, 43.2, 44.5], name: 'Comores' },
  CD: { bounds: [-13.5, 5.4, 12.2, 31.3], name: 'República Democrática do Congo' },
  CG: { bounds: [-5.1, 3.7, 11.1, 18.7], name: 'República do Congo' },
  DJ: { bounds: [10.9, 12.7, 41.8, 43.5], name: 'Djibuti' },
  EG: { bounds: [21.7, 31.7, 24.7, 36.9], name: 'Egito' },
  GQ: { bounds: [0.9, 2.4, 9.3, 11.3], name: 'Guiné Equatorial' },
  ER: { bounds: [12.4, 18.0, 36.4, 43.1], name: 'Eritreia' },
  SZ: { bounds: [-27.3, -25.7, 30.8, 32.1], name: 'Essuatíni' },
  ET: { bounds: [3.4, 14.9, 32.9, 48.0], name: 'Etiópia' },
  GA: { bounds: [-4.0, 2.3, 8.7, 14.5], name: 'Gabão' },
  GM: { bounds: [13.1, 13.8, -17.0, -13.8], name: 'Gâmbia' },
  GH: { bounds: [4.7, 11.2, -3.3, 1.2], name: 'Gana' },
  GN: { bounds: [7.2, 12.7, -15.1, -7.6], name: 'Guiné' },
  GW: { bounds: [10.9, 12.7, -16.7, -13.6], name: 'Guiné-Bissau' },
  CI: { bounds: [4.4, 10.7, -8.6, -2.5], name: 'Costa do Marfim' },
  KE: { bounds: [-4.7, 5.0, 33.9, 41.9], name: 'Quénia' },
  LS: { bounds: [-30.7, -28.6, 27.0, 29.5], name: 'Lesoto' },
  LR: { bounds: [4.3, 8.6, -11.5, -7.4], name: 'Libéria' },
  LY: { bounds: [19.5, 33.2, 9.3, 25.2], name: 'Líbia' },
  MG: { bounds: [-25.6, -11.9, 43.2, 50.5], name: 'Madagáscar' },
  MW: { bounds: [-17.1, -9.4, 32.7, 35.9], name: 'Malawi' },
  ML: { bounds: [10.1, 25.0, -12.2, 4.3], name: 'Mali' },
  MR: { bounds: [14.7, 27.3, -17.1, -4.8], name: 'Mauritânia' },
  MU: { bounds: [-20.5, -19.9, 57.3, 57.8], name: 'Maurícia' },
  MA: { bounds: [27.7, 35.9, -13.2, -1.0], name: 'Marrocos' },
  MZ: { bounds: [-26.9, -10.5, 30.2, 40.8], name: 'Moçambique' },
  NA: { bounds: [-29.0, -16.9, 11.7, 25.3], name: 'Namíbia' },
  NE: { bounds: [11.7, 23.5, 0.2, 16.0], name: 'Níger' },
  NG: { bounds: [4.3, 13.9, 2.7, 14.7], name: 'Nigéria' },
  RW: { bounds: [-2.8, -1.1, 28.9, 30.9], name: 'Ruanda' },
  ST: { bounds: [0.0, 1.7, 6.5, 7.5], name: 'São Tomé e Príncipe' },
  SN: { bounds: [12.3, 16.7, -17.5, -11.4], name: 'Senegal' },
  SC: { bounds: [-10.2, -3.7, 45.8, 56.3], name: 'Seicheles' },
  SL: { bounds: [6.9, 10.0, -13.3, -10.3], name: 'Serra Leoa' },
  SO: { bounds: [-1.7, 12.0, 40.9, 51.4], name: 'Somália' },
  ZA: { bounds: [-35.0, -22.1, 16.4, 33.0], name: 'África do Sul' },
  SS: { bounds: [3.5, 12.2, 23.4, 35.9], name: 'Sudão do Sul' },
  SD: { bounds: [8.7, 22.2, 21.8, 38.6], name: 'Sudão' },
  TZ: { bounds: [-11.8, -1.0, 29.3, 40.4], name: 'Tanzânia' },
  TG: { bounds: [6.0, 11.2, -0.2, 1.8], name: 'Togo' },
  TN: { bounds: [30.2, 37.5, 7.5, 11.6], name: 'Tunísia' },
  UG: { bounds: [-1.5, 4.2, 29.6, 35.0], name: 'Uganda' },
  ZM: { bounds: [-18.1, -8.2, 22.0, 33.7], name: 'Zâmbia' },
  ZW: { bounds: [-22.4, -15.6, 25.2, 33.1], name: 'Zimbábue' },
};

export function useGPSValidation() {
  const { toast } = useToast();

  const validateCoordinates = async (
    countryCode: string,
    latitude: number,
    longitude: number
  ): Promise<GPSValidationResult> => {
    try {
      // Handle empty or undefined country code - skip validation
      if (!countryCode || countryCode.trim() === '') {
        console.warn('GPS validation skipped: country code not provided');
        return { isValid: true };
      }

      // Validate latitude and longitude are numbers
      if (isNaN(latitude) || isNaN(longitude)) {
        return {
          isValid: false,
          error: 'Coordenadas GPS inválidas: valores não numéricos',
        };
      }

      const countryData = COUNTRY_BOUNDS[countryCode.toUpperCase()];

      if (!countryData) {
        // Country not in predefined list - allow validation (no bounds configured)
        console.warn('Country bounds not configured for:', countryCode);
        return { isValid: true };
      }

      const [minLat, maxLat, minLon, maxLon] = countryData.bounds;

      // Validate coordinates are within bounds
      const isWithinBounds = 
        latitude >= minLat &&
        latitude <= maxLat &&
        longitude >= minLon &&
        longitude <= maxLon;

      if (!isWithinBounds) {
        return {
          isValid: false,
          error: `As coordenadas GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) não estão dentro dos limites geográficos de ${countryData.name}. Por favor, verifique se está no país correto.`,
        };
      }

      return { isValid: true };
    } catch (error) {
      console.error('GPS validation exception:', error);
      return {
        isValid: false,
        error: 'Erro ao validar coordenadas GPS',
      };
    }
  };

  const validateAndNotify = async (
    countryCode: string,
    latitude: number,
    longitude: number
  ): Promise<boolean> => {
    const result = await validateCoordinates(countryCode, latitude, longitude);

    if (!result.isValid) {
      toast({
        title: 'Coordenadas GPS Inválidas',
        description: result.error || 'As coordenadas não pertencem ao país selecionado',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  return {
    validateCoordinates,
    validateAndNotify,
  };
}
