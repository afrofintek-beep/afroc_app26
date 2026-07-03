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
 * @module ATS (Address Trust Score) display helpers + types
 * @description The scoring algorithm is authoritative on the server. This module
 * only exposes types and pure display helpers (colors, level lookup) used by the
 * client to render server-provided scores.
 */

export interface ATSScoreBreakdown {
  gps: number;
  telecom: number;
  exif: number;
  witness: number;
  audit: number;
  total: number;
}

export interface ATSScoreInput {
  // GPS data
  hasGpsCoordinates: boolean;
  gpsAccuracy?: number; // meters
  hasGpsValidation?: boolean;
  
  // EXIF/Telecom data (device info from photo)
  hasExifData: boolean;
  hasExifGps: boolean;
  hasDeviceInfo: boolean;
  gpsExifMatch?: boolean; // GPS coordinates match EXIF GPS
  
  // Witness data
  totalWitnesses: number;
  confirmedWitnesses: number;
  validatedWitnesses?: number;
  averageWitnessReputation?: number; // 0-100 reputation score
  
  // Documentation/Audit
  hasDocuments: boolean;
  verifiedDocuments: number;
  hasOfficialValidation?: boolean;
  hasStreetAddress?: boolean;
  hasHouseNumber?: boolean;

  // Proof of Daily Presence (silent verifier) — 0..100
  podpScore?: number;
}

export interface CertificationLevel {
  level: 0 | 1 | 2 | 3 | 4;
  name: string;
  nameKey: string;
  description: string;
  descriptionKey: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

/**
 * Pure lookup that maps the SERVER-provided certification level (0-4) to its
 * display metadata. The scoring/threshold decision now lives on the server; the
 * client only renders the resulting level. No numeric score thresholds here.
 */
const CERTIFICATION_LEVELS: Record<0 | 1 | 2 | 3 | 4, CertificationLevel> = {
  4: {
    level: 4,
    name: "Fully Certified",
    nameKey: "ats.level4.name",
    description: "All validation layers complete with highest trust score",
    descriptionKey: "ats.level4.description",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950",
    borderColor: "border-amber-200 dark:border-amber-800"
  },
  3: {
    level: 3,
    name: "Multi-Layer Verified",
    nameKey: "ats.level3.name",
    description: "GPS, telecom, EXIF, and witness validation complete",
    descriptionKey: "ats.level3.description",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    borderColor: "border-purple-200 dark:border-purple-800"
  },
  2: {
    level: 2,
    name: "Strong Verified",
    nameKey: "ats.level2.name",
    description: "GPS and telecom/EXIF validation complete",
    descriptionKey: "ats.level2.description",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800"
  },
  1: {
    level: 1,
    name: "Basic Verified",
    nameKey: "ats.level1.name",
    description: "GPS capture obtained with basic validation",
    descriptionKey: "ats.level1.description",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950",
    borderColor: "border-green-200 dark:border-green-800"
  },
  0: {
    level: 0,
    name: "Unverified",
    nameKey: "ats.level0.name",
    description: "No verification completed",
    descriptionKey: "ats.level0.description",
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-950",
    borderColor: "border-gray-200 dark:border-gray-800"
  }
};

export const getCertificationLevelByLevel = (level: 0 | 1 | 2 | 3 | 4): CertificationLevel => {
  return CERTIFICATION_LEVELS[level] ?? CERTIFICATION_LEVELS[0];
};

export const getATSScoreColor = (score: number): string => {
  if (score >= 80) return "text-amber-600 dark:text-amber-400";
  if (score >= 60) return "text-purple-600 dark:text-purple-400";
  if (score >= 40) return "text-blue-600 dark:text-blue-400";
  if (score >= 20) return "text-green-600 dark:text-green-400";
  return "text-gray-600 dark:text-gray-400";
};

export const getATSProgressColor = (score: number): string => {
  if (score >= 80) return "bg-amber-500";
  if (score >= 60) return "bg-purple-500";
  if (score >= 40) return "bg-blue-500";
  if (score >= 20) return "bg-green-500";
  return "bg-gray-400";
};
