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
 * @module Verification Risk Calculation System
 * @description Determines cyclic verification frequency for validated AFROLOC addresses
 * based on multiple risk/precariousness criteria.
 * 
 * Risk Categories:
 * - Very Low Risk: 1 verification/year (12-month cycle)
 * - Low Risk: 2 verifications/year (6-month cycle)
 * - Medium Risk: 3 verifications/year (4-month cycle)
 * - High Risk: 4 verifications/year (3-month cycle)
 * - Very High Risk: 6 verifications/year (2-month cycle)
 */

export interface AddressRiskInput {
  // Address completeness
  streetName?: string | null;
  number?: string | null;
  streetCode?: string | null;
  
  // Address type
  addressType?: 'formal' | 'digital' | string | null;
  propertyType?: string | null;
  
  // Validation data
  status?: string | null;
  lastVerifiedAt?: string | null;
  nextVerificationDue?: string | null;
  
  // GPS/Location data
  geoLat?: number | null;
  geoLon?: number | null;
  gpsValidatedAt?: string | null;
  
  // EXIF data
  photoExifGpsLat?: number | null;
  photoExifGpsLon?: number | null;
  
  // Witness data
  witnessCount?: number;
  confirmedWitnessCount?: number;
  
  // ATS Score (0-100)
  atsScore?: number | null;
  
  // Registration date
  createdAt?: string | null;
}

export interface VerificationRiskResult {
  // Risk score (0-100, higher = more precarious)
  riskScore: number;
  
  // Risk level classification
  riskLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  riskColor: string;
  
  // Verification frequency
  verificationsPerYear: number;
  cycleDurationMonths: number;
  cycleDurationDays: number;
  
  // Cycle calculation
  currentCycle: number;
  cycleProgress: number;
  daysRemaining: number;
  cycleStartDate: Date;
  cycleEndDate: Date;
  
  // Status
  status: 'verified' | 'upcoming' | 'urgent' | 'overdue';
  statusColor: string;
  
  // Risk breakdown for transparency
  riskBreakdown: {
    addressCompleteness: number; // 0-20
    propertyStability: number;   // 0-15
    gpsValidation: number;       // 0-15
    witnessQuality: number;      // 0-15
    atsScore: number;            // 0-20
    verificationHistory: number; // 0-15
  };
  
  // Mitigation suggestion keys (translation keys, not hardcoded strings)
  mitigationSuggestions: string[];
}

/**
 * Property type stability scores
 * Higher score = less stable/more precarious
 */
const PROPERTY_TYPE_RISK: Record<string, number> = {
  'residência': 5,          // Most stable
  'comercial': 8,           // Relatively stable
  'industrial': 7,          // Stable
  'agrícola': 10,           // Moderate stability
  'terreno': 12,            // Less stable - undeveloped
  'construção': 15,         // In progress - high change risk
  'temporário': 18,         // Temporary - very unstable
  'informal': 20,           // Informal - highest risk
};

/**
 * Calculate verification risk and frequency for an AFROLOC address
 */
export function calculateVerificationRisk(input: AddressRiskInput): VerificationRiskResult {
  const breakdown = {
    addressCompleteness: 0,
    propertyStability: 0,
    gpsValidation: 0,
    witnessQuality: 0,
    atsScore: 0,
    verificationHistory: 0,
  };
  
  // Use translation keys instead of hardcoded strings
  const mitigationSuggestionKeys: string[] = [];
  
  // ========================================
  // Factor 1: Address Completeness (0-20 points)
  // ========================================
  const hasStreetName = !!input.streetName;
  const hasNumber = !!input.number;
  const hasStreetCode = !!input.streetCode;
  const isFormalAddress = input.addressType === 'formal' || (hasStreetName && hasNumber);
  
  if (isFormalAddress && hasStreetCode) {
    breakdown.addressCompleteness = 0; // Fully complete
  } else if (isFormalAddress) {
    breakdown.addressCompleteness = 5; // Complete but no street code
  } else if (hasStreetName) {
    breakdown.addressCompleteness = 10; // Partial - has street but no number
    mitigationSuggestionKeys.push('mitigation_add_house_number');
  } else {
    breakdown.addressCompleteness = 20; // Digital address only
    mitigationSuggestionKeys.push('mitigation_digital_frequent_verification');
  }
  
  // ========================================
  // Factor 2: Property Type Stability (0-15 points)
  // ========================================
  const propertyType = input.propertyType?.toLowerCase() || 'residência';
  const propertyRisk = PROPERTY_TYPE_RISK[propertyType] || 10;
  breakdown.propertyStability = Math.min(Math.round(propertyRisk * 0.75), 15);
  
  if (propertyRisk > 12) {
    mitigationSuggestionKeys.push('mitigation_property_monitoring');
  }
  
  // ========================================
  // Factor 3: GPS Validation (0-15 points)
  // ========================================
  const hasGpsCoords = !!(input.geoLat && input.geoLon);
  const hasGpsValidation = !!input.gpsValidatedAt;
  const hasExifGps = !!(input.photoExifGpsLat && input.photoExifGpsLon);
  
  // Check GPS-EXIF consistency
  let gpsExifConsistent = true;
  if (hasGpsCoords && hasExifGps) {
    const latDiff = Math.abs((input.geoLat || 0) - (input.photoExifGpsLat || 0));
    const lonDiff = Math.abs((input.geoLon || 0) - (input.photoExifGpsLon || 0));
    gpsExifConsistent = latDiff < 0.001 && lonDiff < 0.001; // ~100m tolerance
  }
  
  if (hasGpsCoords && hasGpsValidation && hasExifGps && gpsExifConsistent) {
    breakdown.gpsValidation = 0; // Best case
  } else if (hasGpsCoords && hasExifGps && gpsExifConsistent) {
    breakdown.gpsValidation = 5; // Good but not officially validated
  } else if (hasGpsCoords && hasGpsValidation) {
    breakdown.gpsValidation = 5; // Validated but no EXIF
  } else if (hasGpsCoords) {
    breakdown.gpsValidation = 10; // Has GPS but not validated
    mitigationSuggestionKeys.push('mitigation_gps_authority_validation');
  } else {
    breakdown.gpsValidation = 15; // No GPS data
    mitigationSuggestionKeys.push('mitigation_gps_required');
  }
  
  if (!gpsExifConsistent && hasGpsCoords && hasExifGps) {
    breakdown.gpsValidation = Math.min(breakdown.gpsValidation + 5, 15);
    mitigationSuggestionKeys.push('mitigation_gps_exif_discrepancy');
  }
  
  // ========================================
  // Factor 4: Witness Quality (0-15 points)
  // ========================================
  const witnessCount = input.witnessCount || 0;
  const confirmedCount = input.confirmedWitnessCount || 0;
  
  if (confirmedCount >= 2) {
    breakdown.witnessQuality = 0; // Excellent witness coverage
  } else if (confirmedCount === 1) {
    breakdown.witnessQuality = 5; // Minimum witness
    mitigationSuggestionKeys.push('mitigation_add_more_witnesses');
  } else if (witnessCount > 0) {
    breakdown.witnessQuality = 10; // Has witnesses but not confirmed
    mitigationSuggestionKeys.push('mitigation_witnesses_pending');
  } else {
    breakdown.witnessQuality = 15; // No witnesses
    mitigationSuggestionKeys.push('mitigation_add_witnesses');
  }
  
  // ========================================
  // Factor 5: ATS Score (0-20 points)
  // ========================================
  const atsScore = input.atsScore || 0;
  
  if (atsScore >= 80) {
    breakdown.atsScore = 0; // Excellent ATS
  } else if (atsScore >= 60) {
    breakdown.atsScore = 5; // Good ATS
  } else if (atsScore >= 40) {
    breakdown.atsScore = 10; // Moderate ATS
    mitigationSuggestionKeys.push('mitigation_improve_ats');
  } else if (atsScore >= 20) {
    breakdown.atsScore = 15; // Low ATS
    mitigationSuggestionKeys.push('mitigation_low_ats');
  } else {
    breakdown.atsScore = 20; // Very low or no ATS
    mitigationSuggestionKeys.push('mitigation_complete_ats');
  }
  
  // ========================================
  // Factor 6: Verification History (0-15 points)
  // ========================================
  const now = new Date();
  
  if (input.lastVerifiedAt) {
    const lastVerified = new Date(input.lastVerifiedAt);
    const daysSinceVerification = Math.floor(
      (now.getTime() - lastVerified.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceVerification <= 90) {
      breakdown.verificationHistory = 0; // Recently verified
    } else if (daysSinceVerification <= 180) {
      breakdown.verificationHistory = 5; // Verified within 6 months
    } else if (daysSinceVerification <= 365) {
      breakdown.verificationHistory = 10; // Verified within a year
      mitigationSuggestionKeys.push('mitigation_over_6_months');
    } else {
      breakdown.verificationHistory = 15; // Over a year
      mitigationSuggestionKeys.push('mitigation_over_1_year');
    }
  } else if (input.createdAt) {
    // Never verified - check age of registration
    const created = new Date(input.createdAt);
    const daysSinceCreation = Math.floor(
      (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceCreation <= 30) {
      breakdown.verificationHistory = 5; // New registration
    } else {
      breakdown.verificationHistory = 15; // Old but never verified
      mitigationSuggestionKeys.push('mitigation_never_verified');
    }
  } else {
    breakdown.verificationHistory = 15; // No verification data
  }
  
  // ========================================
  // Calculate Total Risk Score
  // ========================================
  const riskScore = Math.min(
    breakdown.addressCompleteness +
    breakdown.propertyStability +
    breakdown.gpsValidation +
    breakdown.witnessQuality +
    breakdown.atsScore +
    breakdown.verificationHistory,
    100
  );
  
  // ========================================
  // Determine Risk Level and Frequency
  // ========================================
  let riskLevel: VerificationRiskResult['riskLevel'];
  let riskColor: string;
  let verificationsPerYear: number;
  let cycleDurationMonths: number;
  
  if (riskScore < 15) {
    riskLevel = 'very_low';
    riskColor = 'hsl(var(--chart-2))'; // green
    verificationsPerYear = 1;
    cycleDurationMonths = 12;
  } else if (riskScore < 35) {
    riskLevel = 'low';
    riskColor = 'hsl(var(--chart-2))';
    verificationsPerYear = 2;
    cycleDurationMonths = 6;
  } else if (riskScore < 55) {
    riskLevel = 'medium';
    riskColor = 'hsl(var(--chart-3))'; // blue/neutral
    verificationsPerYear = 3;
    cycleDurationMonths = 4;
  } else if (riskScore < 75) {
    riskLevel = 'high';
    riskColor = 'hsl(var(--warning))'; // yellow/orange
    verificationsPerYear = 4;
    cycleDurationMonths = 3;
  } else {
    riskLevel = 'very_high';
    riskColor = 'hsl(var(--destructive))'; // red
    verificationsPerYear = 6;
    cycleDurationMonths = 2;
  }
  
  const cycleDurationDays = Math.round(cycleDurationMonths * 30.44);
  
  // ========================================
  // Calculate Current Cycle Position
  // ========================================
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const monthsSinceYearStart = now.getMonth();
  const currentCycle = Math.floor(monthsSinceYearStart / cycleDurationMonths) + 1;
  
  const cycleStartMonth = (currentCycle - 1) * cycleDurationMonths;
  const cycleStartDate = new Date(now.getFullYear(), cycleStartMonth, 1);
  const cycleEndDate = new Date(now.getFullYear(), cycleStartMonth + cycleDurationMonths, 0, 23, 59, 59);
  
  // Handle year boundary
  if (cycleEndDate < now) {
    cycleEndDate.setFullYear(cycleEndDate.getFullYear() + 1);
  }
  
  const cycleTotal = cycleEndDate.getTime() - cycleStartDate.getTime();
  const cycleElapsed = now.getTime() - cycleStartDate.getTime();
  const cycleProgress = Math.min(Math.max((cycleElapsed / cycleTotal) * 100, 0), 100);
  
  const daysRemaining = Math.max(
    Math.ceil((cycleEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    0
  );
  
  // ========================================
  // Determine Verification Status
  // ========================================
  let status: VerificationRiskResult['status'];
  let statusColor: string;
  
  if (cycleProgress >= 100) {
    status = 'overdue';
    statusColor = 'hsl(var(--destructive))';
  } else if (cycleProgress >= 85) {
    status = 'urgent';
    statusColor = 'hsl(var(--destructive))';
  } else if (cycleProgress >= 60) {
    status = 'upcoming';
    statusColor = 'hsl(var(--warning))';
  } else {
    status = 'verified';
    statusColor = 'hsl(var(--chart-2))';
  }
  
  return {
    riskScore,
    riskLevel,
    riskColor,
    verificationsPerYear,
    cycleDurationMonths,
    cycleDurationDays,
    currentCycle: Math.min(currentCycle, verificationsPerYear),
    cycleProgress,
    daysRemaining,
    cycleStartDate,
    cycleEndDate,
    status,
    statusColor,
    riskBreakdown: breakdown,
    mitigationSuggestions: [...new Set(mitigationSuggestionKeys)], // Remove duplicates - now returns translation keys
  };
}

/**
 * Check if address should show verification cycle indicator
 * Only validated/approved addresses need cyclic verification
 */
export function shouldShowVerificationCycle(status?: string | null): boolean {
  const validatedStatuses = ['approved', 'validated', 'certified', 'active'];
  return validatedStatuses.includes(status?.toLowerCase() || '');
}
