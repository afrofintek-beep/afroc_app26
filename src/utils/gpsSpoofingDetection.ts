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
 * @module GPS Spoofing types + display helpers
 * @description The spoofing detection algorithm is authoritative on the server.
 * This module only exposes types and pure display helpers (risk-level colors)
 * used by the client to render server-provided verdicts.
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

export type SpoofRiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface SpoofingDetectionResult {
  isSuspicious: boolean;
  riskLevel: SpoofRiskLevel;
  riskScore: number; // 0-100
  alerts: SpoofingAlert[];
  recommendation: string;
  recommendationKey: string;
}

// NOTE: The proprietary GPS spoofing detection algorithm (distance/timestamp/
// movement thresholds and risk scoring) is authoritative on the server. This
// module only exposes types and pure display helpers used by the client to
// render server-provided verdicts.

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
