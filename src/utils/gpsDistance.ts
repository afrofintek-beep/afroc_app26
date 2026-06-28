/**
 * AFROLOC - African Digital Address Identification System
 * 
 * Copyright (c) 2024-2026 AFROFINTEK GmbH. All rights reserved.
 * 
 * This file is part of the AFROLOC proprietary software.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited.
 * 
 * For licensing inquiries, contact: legal@afroloc.com
 * 
 * @module GPS Distance Utilities
 * @description Calculate the distance between two GPS coordinates using the Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(2)}km`;
}

/**
 * GPS distance validation thresholds
 */
export const GPS_VALIDATION_THRESHOLDS = {
  // Maximum acceptable distance for a property update (in meters)
  MAX_UPDATE_DISTANCE: 100,
  // Warning distance threshold
  WARNING_DISTANCE: 50,
  // Suspicious distance that requires confirmation
  SUSPICIOUS_DISTANCE: 500,
} as const;

/**
 * Validate GPS update distance
 */
export interface GPSValidationResult {
  isValid: boolean;
  distance: number;
  severity: 'ok' | 'warning' | 'error' | 'suspicious';
  message: string;
}

export function validateGPSUpdate(
  previousLat: number | null,
  previousLon: number | null,
  newLat: number,
  newLon: number
): GPSValidationResult {
  // If no previous coordinates, always valid (first capture)
  if (previousLat === null || previousLon === null) {
    return {
      isValid: true,
      distance: 0,
      severity: 'ok',
      message: 'Primeira captura de coordenadas GPS',
    };
  }

  const distance = calculateDistance(previousLat, previousLon, newLat, newLon);

  if (distance <= GPS_VALIDATION_THRESHOLDS.WARNING_DISTANCE) {
    return {
      isValid: true,
      distance,
      severity: 'ok',
      message: `Localização confirmada (${formatDistance(distance)} da referência anterior).`,
    };
  }

  if (distance <= GPS_VALIDATION_THRESHOLDS.MAX_UPDATE_DISTANCE) {
    return {
      isValid: true,
      distance,
      severity: 'warning',
      message: `A localização actual está a ${formatDistance(distance)} da referência registada. Certifique-se de que se encontra junto à propriedade.`,
    };
  }

  if (distance <= GPS_VALIDATION_THRESHOLDS.SUSPICIOUS_DISTANCE) {
    return {
      isValid: false,
      distance,
      severity: 'error',
      message: `A localização actual difere ${formatDistance(distance)} da referência registada. Para continuar, confirme que está no local correcto.`,
    };
  }

  return {
    isValid: false,
    distance,
    severity: 'suspicious',
    message: `Não foi possível confirmar a proximidade à morada registada (${formatDistance(distance)}). Desloque-se para junto da propriedade e tente novamente.`,
  };
}
