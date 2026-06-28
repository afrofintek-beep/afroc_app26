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
 * @module ATS (Address Trust Score) Calculator
 * @description Based on AFRO ID Operational Handbook specifications
 * 
 * Scoring breakdown (0-100 total):
 * - GPS (0-25 points): Location accuracy and validation
 * - Telecom (0-25 points): Signal triangulation (simulated via EXIF device data)
 * - EXIF (0-20 points): Photo metadata validation
 * - Witness (0-15 points): Community witness confirmations
 * - Audit (0-15 points): Documentation and official validation
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

export const calculateATSScore = (input: ATSScoreInput): ATSScoreBreakdown => {
  let gps = 0;
  let telecom = 0;
  let exif = 0;
  let witness = 0;
  let audit = 0;

  // GPS Score (0-25)
  if (input.hasGpsCoordinates) {
    gps += 10;
    
    // Accuracy bonus
    if (input.gpsAccuracy !== undefined) {
      if (input.gpsAccuracy <= 5) gps += 10; // Excellent accuracy
      else if (input.gpsAccuracy <= 10) gps += 7;
      else if (input.gpsAccuracy <= 15) gps += 5;
      else if (input.gpsAccuracy <= 30) gps += 3;
    } else {
      gps += 5; // Default if no accuracy data
    }
    
    // GPS validation bonus
    if (input.hasGpsValidation) gps += 5;
  }

  // Telecom/Signal Score (0-25)
  // In the app, we use device info as a proxy for telecom triangulation
  if (input.hasDeviceInfo) {
    telecom += 10;
  }
  
  if (input.hasExifGps) {
    telecom += 10;
  }
  
  // GPS-EXIF cross-validation
  if (input.gpsExifMatch !== undefined) {
    if (input.gpsExifMatch) {
      telecom += 5; // Coordinates match
    } else {
      telecom = Math.max(0, telecom - 5); // Penalty for mismatch
    }
  }

  // EXIF Score (0-20)
  if (input.hasExifData) {
    exif += 10;
    
    if (input.hasExifGps) exif += 5;
    if (input.hasDeviceInfo) exif += 5;
  }

  // Witness Score (0-15) - now weighted by reputation
  // Base score for confirmed witnesses (0-7.5)
  if (input.confirmedWitnesses >= 3) {
    witness += 7.5;
  } else if (input.confirmedWitnesses >= 2) {
    witness += 5.0;
  } else if (input.confirmedWitnesses >= 1) {
    witness += 2.5;
  }
  
  // Validation bonus (0-5)
  if (input.validatedWitnesses !== undefined && input.validatedWitnesses > 0) {
    witness += Math.min(input.validatedWitnesses * 2.5, 5);
  }
  
  // Apply reputation multiplier (scales from 0.5 at 0 rep to 1.0 at 100 rep)
  // This weighs the witness score based on the average reputation of witnesses
  const reputation = input.averageWitnessReputation ?? 50;
  const reputationMultiplier = 0.5 + (reputation / 200);
  witness = witness * reputationMultiplier;

  // Audit/Documentation Score (0-15)
  if (input.hasDocuments) {
    audit += 5;
    
    // Bonus per verified document (max 3)
    audit += Math.min(input.verifiedDocuments * 2, 6);
  }
  
  if (input.hasOfficialValidation) {
    audit += 4;
  }
  
  // Address completeness bonus
  if (input.hasStreetAddress && input.hasHouseNumber) {
    audit += Math.min(audit + 2, 15) - audit;
  }

  // Proof of Daily Presence reinforcement (silent verifier): up to +5 audit
  if (typeof input.podpScore === 'number' && input.podpScore > 0) {
    const podpBoost = Math.round((Math.min(input.podpScore, 100) / 100) * 5);
    audit += podpBoost;
  }

  // Cap each category at its maximum
  gps = Math.min(gps, 25);
  telecom = Math.min(telecom, 25);
  exif = Math.min(exif, 20);
  witness = Math.min(witness, 15);
  audit = Math.min(audit, 15);

  const total = gps + telecom + exif + witness + audit;

  return {
    gps,
    telecom,
    exif,
    witness,
    audit,
    total: Math.min(total, 100)
  };
};

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

export const getCertificationLevel = (atsScore: number): CertificationLevel => {
  if (atsScore >= 80) {
    return {
      level: 4,
      name: "Fully Certified",
      nameKey: "ats.level4.name",
      description: "All validation layers complete with highest trust score",
      descriptionKey: "ats.level4.description",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950",
      borderColor: "border-amber-200 dark:border-amber-800"
    };
  } else if (atsScore >= 60) {
    return {
      level: 3,
      name: "Multi-Layer Verified",
      nameKey: "ats.level3.name",
      description: "GPS, telecom, EXIF, and witness validation complete",
      descriptionKey: "ats.level3.description",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950",
      borderColor: "border-purple-200 dark:border-purple-800"
    };
  } else if (atsScore >= 40) {
    return {
      level: 2,
      name: "Strong Verified",
      nameKey: "ats.level2.name",
      description: "GPS and telecom/EXIF validation complete",
      descriptionKey: "ats.level2.description",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      borderColor: "border-blue-200 dark:border-blue-800"
    };
  } else if (atsScore >= 20) {
    return {
      level: 1,
      name: "Basic Verified",
      nameKey: "ats.level1.name",
      description: "GPS capture obtained with basic validation",
      descriptionKey: "ats.level1.description",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-950",
      borderColor: "border-green-200 dark:border-green-800"
    };
  } else {
    return {
      level: 0,
      name: "Unverified",
      nameKey: "ats.level0.name",
      description: "No verification completed",
      descriptionKey: "ats.level0.description",
      color: "text-gray-600 dark:text-gray-400",
      bgColor: "bg-gray-50 dark:bg-gray-950",
      borderColor: "border-gray-200 dark:border-gray-800"
    };
  }
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
