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
 * @module GPS Spoofing Detection System
 * @description Based on AFRO ID Operational Handbook - Chapter 4.5 & 10.10
 * 
 * Detection methods:
 * 1. GPS-EXIF coordinate mismatch
 * 2. Impossible signal combinations
 * 3. Timestamp inconsistencies
 * 4. Distance anomalies
 */

export interface GPSCoordinate {
  latitude: number;
  longitude: number;
  accuracy?: number; // meters
  timestamp?: Date;
}

export interface SpoofingDetectionInput {
  deviceGPS?: GPSCoordinate | null;
  exifGPS?: GPSCoordinate | null;
  exifTimestamp?: string | null;
  deviceTimestamp?: Date;
  previousGPS?: GPSCoordinate | null;
  timeSinceLastCapture?: number; // seconds
}

export interface SpoofingAlert {
  type: 'critical' | 'warning' | 'info';
  code: string;
  title: string;
  titleKey: string;
  message: string;
  messageKey: string;
  details?: string;
}

export interface SpoofingDetectionResult {
  isSuspicious: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100
  alerts: SpoofingAlert[];
  recommendation: string;
  recommendationKey: string;
}

/**
 * Calculate distance between two GPS coordinates in meters
 * Using Haversine formula
 */
export function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Detect potential GPS spoofing based on multiple signals
 */
export function detectGPSSpoofing(input: SpoofingDetectionInput): SpoofingDetectionResult {
  const alerts: SpoofingAlert[] = [];
  let riskScore = 0;

  // 1. GPS-EXIF Coordinate Mismatch Detection
  if (input.deviceGPS && input.exifGPS) {
    const distance = calculateDistance(
      input.deviceGPS.latitude,
      input.deviceGPS.longitude,
      input.exifGPS.latitude,
      input.exifGPS.longitude
    );

    if (distance > 5000) { // > 5km
      riskScore += 50;
      alerts.push({
        type: 'critical',
        code: 'GPS_EXIF_MAJOR_MISMATCH',
        title: 'Discrepância GPS Crítica',
        titleKey: 'spoofing.gps_exif_major_mismatch.title',
        message: `A foto foi tirada a ${(distance / 1000).toFixed(1)}km da localização do dispositivo. Possível manipulação de GPS.`,
        messageKey: 'spoofing.gps_exif_major_mismatch.message',
        details: `Dispositivo: ${input.deviceGPS.latitude.toFixed(6)}, ${input.deviceGPS.longitude.toFixed(6)} | EXIF: ${input.exifGPS.latitude.toFixed(6)}, ${input.exifGPS.longitude.toFixed(6)}`
      });
    } else if (distance > 1000) { // > 1km
      riskScore += 30;
      alerts.push({
        type: 'warning',
        code: 'GPS_EXIF_MISMATCH',
        title: 'Discrepância de Localização',
        titleKey: 'spoofing.gps_exif_mismatch.title',
        message: `Diferença de ${Math.round(distance)}m entre GPS do dispositivo e foto. Verifique a precisão.`,
        messageKey: 'spoofing.gps_exif_mismatch.message',
        details: `Distância detectada: ${Math.round(distance)}m`
      });
    } else if (distance > 200) { // > 200m
      riskScore += 10;
      alerts.push({
        type: 'info',
        code: 'GPS_EXIF_MINOR_DIFF',
        title: 'Pequena Variação GPS',
        titleKey: 'spoofing.gps_exif_minor_diff.title',
        message: `Variação de ${Math.round(distance)}m detectada. Normal para GPS indoor.`,
        messageKey: 'spoofing.gps_exif_minor_diff.message'
      });
    }
  }

  // 2. Missing EXIF GPS when device has GPS
  if (input.deviceGPS && !input.exifGPS) {
    riskScore += 5;
    alerts.push({
      type: 'info',
      code: 'NO_EXIF_GPS',
      title: 'Sem GPS na Foto',
      titleKey: 'spoofing.no_exif_gps.title',
      message: 'A foto não contém coordenadas GPS embutidas. Isso pode ser normal em alguns dispositivos.',
      messageKey: 'spoofing.no_exif_gps.message'
    });
  }

  // 3. Timestamp Inconsistency Detection
  // Note: EXIF timestamps may be in local time without timezone info, or in UTC.
  // We need to be more lenient with timezone differences (up to 14 hours for extreme timezones).
  if (input.exifTimestamp && input.deviceTimestamp) {
    const exifDate = new Date(input.exifTimestamp);
    
    // Check if the EXIF date is valid
    if (!isNaN(exifDate.getTime())) {
      const timeDiff = Math.abs(input.deviceTimestamp.getTime() - exifDate.getTime());
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      // Account for timezone differences - EXIF timestamps may not include timezone
      // Maximum timezone offset is 14 hours (UTC+14 to UTC-12 = 26 hours range)
      // We'll use 15 hours as the tolerance for timezone + minor clock drift
      const timezoneToleranceHours = 15;

      // Only flag as major mismatch if it's clearly old (more than 24h + timezone tolerance)
      if (hoursDiff > 24 + timezoneToleranceHours) {
        riskScore += 40;
        alerts.push({
          type: 'critical',
          code: 'TIMESTAMP_MAJOR_MISMATCH',
          title: 'Foto Antiga Detectada',
          titleKey: 'spoofing.timestamp_major_mismatch.title',
          message: `A foto foi tirada há ${Math.floor((hoursDiff - timezoneToleranceHours) / 24)} dias. Fotos devem ser recentes.`,
          messageKey: 'spoofing.timestamp_major_mismatch.message',
          details: `Data EXIF: ${exifDate.toLocaleString()}`
        });
      } else if (hoursDiff > timezoneToleranceHours + 1) {
        // Only show warning if it's clearly beyond timezone differences
        riskScore += 20;
        alerts.push({
          type: 'warning',
          code: 'TIMESTAMP_MISMATCH',
          title: 'Horário Inconsistente',
          titleKey: 'spoofing.timestamp_mismatch.title',
          message: `Diferença de ${Math.round(hoursDiff - timezoneToleranceHours)} horas entre foto e registro.`,
          messageKey: 'spoofing.timestamp_mismatch.message'
        });
      }
      // For differences within timezone tolerance (0-15 hours), we don't flag anything
      // as this is likely just timezone metadata issues in the EXIF data
    }
  }

  // 4. Impossible Movement Detection
  if (input.previousGPS && input.deviceGPS && input.timeSinceLastCapture) {
    const distance = calculateDistance(
      input.previousGPS.latitude,
      input.previousGPS.longitude,
      input.deviceGPS.latitude,
      input.deviceGPS.longitude
    );
    
    // Calculate speed in km/h
    const speedKmh = (distance / 1000) / (input.timeSinceLastCapture / 3600);

    // Impossible speed (> 1000 km/h - faster than commercial aircraft)
    if (speedKmh > 1000) {
      riskScore += 60;
      alerts.push({
        type: 'critical',
        code: 'IMPOSSIBLE_MOVEMENT',
        title: 'Movimento Impossível',
        titleKey: 'spoofing.impossible_movement.title',
        message: `Velocidade calculada de ${Math.round(speedKmh)}km/h é fisicamente impossível.`,
        messageKey: 'spoofing.impossible_movement.message',
        details: `Distância: ${(distance / 1000).toFixed(1)}km em ${Math.round(input.timeSinceLastCapture / 60)}min`
      });
    } else if (speedKmh > 300) { // Faster than high-speed train
      riskScore += 30;
      alerts.push({
        type: 'warning',
        code: 'SUSPICIOUS_MOVEMENT',
        title: 'Movimento Suspeito',
        titleKey: 'spoofing.suspicious_movement.title',
        message: `Velocidade de ${Math.round(speedKmh)}km/h é muito alta. Verifique a localização.`,
        messageKey: 'spoofing.suspicious_movement.message'
      });
    }
  }

  // 5. GPS Accuracy Check
  if (input.deviceGPS?.accuracy && input.deviceGPS.accuracy > 100) {
    riskScore += 15;
    alerts.push({
      type: 'warning',
      code: 'LOW_GPS_ACCURACY',
      title: 'Precisão GPS Baixa',
      titleKey: 'spoofing.low_gps_accuracy.title',
      message: `Precisão GPS de ${Math.round(input.deviceGPS.accuracy)}m é muito baixa. Mova-se para um local com melhor sinal.`,
      messageKey: 'spoofing.low_gps_accuracy.message'
    });
  }

  // Determine risk level
  let riskLevel: SpoofingDetectionResult['riskLevel'];
  let recommendation: string;
  let recommendationKey: string;

  if (riskScore >= 80) {
    riskLevel = 'critical';
    recommendation = 'Registro bloqueado. Evidências fortes de manipulação de GPS detectadas. Por favor, desative aplicativos de GPS falso e tente novamente.';
    recommendationKey = 'spoofing.recommendation.critical';
  } else if (riskScore >= 50) {
    riskLevel = 'high';
    recommendation = 'Atenção: possível manipulação detectada. Verifique se está no local correto e tire uma nova foto.';
    recommendationKey = 'spoofing.recommendation.high';
  } else if (riskScore >= 30) {
    riskLevel = 'medium';
    recommendation = 'Algumas inconsistências detectadas. Verifique a precisão do GPS e tire uma nova foto.';
    recommendationKey = 'spoofing.recommendation.medium';
  } else if (riskScore >= 10) {
    riskLevel = 'low';
    recommendation = 'Pequenas variações detectadas, mas dentro do esperado.';
    recommendationKey = 'spoofing.recommendation.low';
  } else {
    riskLevel = 'none';
    recommendation = 'Nenhum problema detectado. Coordenadas validadas.';
    recommendationKey = 'spoofing.recommendation.none';
  }

  return {
    isSuspicious: riskScore >= 30,
    riskLevel,
    riskScore: Math.min(riskScore, 100),
    alerts,
    recommendation,
    recommendationKey
  };
}

/**
 * Get color classes for risk level
 */
export function getRiskLevelColors(riskLevel: SpoofingDetectionResult['riskLevel']) {
  switch (riskLevel) {
    case 'critical':
      return {
        text: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-950',
        border: 'border-red-200 dark:border-red-800',
        icon: 'text-red-600 dark:text-red-400'
      };
    case 'high':
      return {
        text: 'text-orange-600 dark:text-orange-400',
        bg: 'bg-orange-50 dark:bg-orange-950',
        border: 'border-orange-200 dark:border-orange-800',
        icon: 'text-orange-600 dark:text-orange-400'
      };
    case 'medium':
      return {
        text: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950',
        border: 'border-amber-200 dark:border-amber-800',
        icon: 'text-amber-600 dark:text-amber-400'
      };
    case 'low':
      return {
        text: 'text-yellow-600 dark:text-yellow-400',
        bg: 'bg-yellow-50 dark:bg-yellow-950',
        border: 'border-yellow-200 dark:border-yellow-800',
        icon: 'text-yellow-600 dark:text-yellow-400'
      };
    default:
      return {
        text: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-50 dark:bg-green-950',
        border: 'border-green-200 dark:border-green-800',
        icon: 'text-green-600 dark:text-green-400'
      };
  }
}
