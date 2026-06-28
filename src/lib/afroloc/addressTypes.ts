/**
 * AFROLOC Address Core - Type Definitions
 * Copyright © 2025 AFROFINTEK GmbH. All rights reserved.
 */

/** Geographic reference with coordinates and accuracy */
export interface GeoRef {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  source?: 'gps' | 'network' | 'manual' | 'geocoded';
  timestamp?: string;
}

/** Thoroughfare (street/road) information */
export interface Thoroughfare {
  type: string;
  typeAbbrev?: string;
  name: string;
  fullName?: string;
}

/** Premise (building/property) information */
export interface Premise {
  number: string;
  name?: string;
  type?: string;
}

/** Sub-premise (unit within a building) information */
export interface SubPremise {
  type: string;
  typeAbbrev?: string;
  identifier: string;
  floor?: string;
}

/** Complete address structure */
export interface Address {
  id?: string;
  code?: string;
  country: string;
  countryCode: string;
  level1?: {
    code: string;
    name: string;
  };
  level2?: {
    code: string;
    name: string;
  };
  level3?: {
    code: string;
    name: string;
  };
  level4?: {
    code: string;
    name: string;
  };
  thoroughfare?: Thoroughfare;
  premise?: Premise;
  subPremise?: SubPremise;
  postalCode?: string;
  geoRef?: GeoRef;
  formatted?: string;
  rawInput?: string;
}

/** Validation result for an address */
export interface ValidateResponse {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  confidence: number;
  suggestions?: Address[];
}

/** Validation error details */
export interface ValidationError {
  field: string;
  code: string;
  message: string;
}

/** Validation warning details */
export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
}

/** Normalization result */
export interface NormalizeResponse {
  success: boolean;
  normalized: Address;
  changes: NormalizationChange[];
  originalInput: string;
}

/** Details of a normalization change */
export interface NormalizationChange {
  field: string;
  original: string;
  normalized: string;
  rule: string;
}

/** Format options for address output */
export interface FormatOptions {
  style: 'full' | 'short' | 'oneline' | 'code';
  includeCountry?: boolean;
  includePostalCode?: boolean;
  includeGeoRef?: boolean;
  uppercase?: boolean;
  locale?: string;
}

/** Formatted address response */
export interface FormatResponse {
  success: boolean;
  formatted: string;
  style: string;
  lines?: string[];
}
