/**
 * AFROLOC Address Core - Rules and Helpers
 * Copyright © 2025 AFROFINTEK GmbH. All rights reserved.
 */

/** Thoroughfare type mappings (full name → abbreviation) */
export const THOROUGHFARE_TYPES: Record<string, string> = {
  "AVENIDA": "AV",
  "AV.": "AV",
  "AV": "AV",
  "RUA": "R",
  "R.": "R",
  "TRAVESSA": "TR",
  "TRAV.": "TR",
  "TRAV": "TR",
  "PRAÇA": "PC",
  "PRACA": "PC",
  "PÇ.": "PC",
  "PÇ": "PC",
  "ALAMEDA": "AL",
  "AL.": "AL",
  "LARGO": "LG",
  "LG.": "LG",
  "ESTRADA": "EST",
  "EST.": "EST",
  "BECO": "BC",
  "BC.": "BC",
  "CAMINHO": "CAM",
  "CAM.": "CAM",
  "ROTUNDA": "ROT",
  "ROT.": "ROT",
};

/** Sub-premise type mappings (full name → abbreviation) */
export const SUBPREMISE_TYPES: Record<string, string> = {
  "APARTAMENTO": "AP",
  "APTO": "AP",
  "APTO.": "AP",
  "APT": "AP",
  "APT.": "AP",
  "AP": "AP",
  "LOJA": "LOJ",
  "LJ": "LOJ",
  "LJ.": "LOJ",
  "SALA": "SALA",
  "SL": "SALA",
  "SL.": "SALA",
  "ESCRITÓRIO": "ESC",
  "ESCRITORIO": "ESC",
  "ESC": "ESC",
  "ESC.": "ESC",
  "ANDAR": "AND",
  "AND": "AND",
  "AND.": "AND",
  "BLOCO": "BL",
  "BL": "BL",
  "BL.": "BL",
  "CAVE": "CV",
  "CV": "CV",
  "SOBRELOJA": "SBL",
  "SBL": "SBL",
};

/** Premise type mappings */
export const PREMISE_TYPES: Record<string, string> = {
  "EDIFÍCIO": "ED",
  "EDIFICIO": "ED",
  "ED.": "ED",
  "ED": "ED",
  "PRÉDIO": "PR",
  "PREDIO": "PR",
  "PR.": "PR",
  "CASA": "CS",
  "CS": "CS",
  "VIVENDA": "VIV",
  "VIV": "VIV",
  "LOTE": "LT",
  "LT": "LT",
  "LT.": "LT",
  "MORADIA": "MOR",
  "MOR": "MOR",
};

/**
 * Remove extra whitespace and trim
 */
export function cleanSpaces(s: string): string {
  if (!s) return "";
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Convert string to uppercase with proper handling
 */
export function toUpperLabel(s: string): string {
  if (!s) return "";
  return cleanSpaces(s).toUpperCase();
}

/**
 * Remove accents/diacritics from string
 */
export function stripAccents(s: string): string {
  if (!s) return "";
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalize a thoroughfare type to its abbreviation
 */
export function normalizeThoroughfareType(type: string): string {
  const normalized = toUpperLabel(stripAccents(type));
  return THOROUGHFARE_TYPES[normalized] || normalized;
}

/**
 * Normalize a sub-premise type to its abbreviation
 */
export function normalizeSubPremiseType(type: string): string {
  const normalized = toUpperLabel(stripAccents(type));
  return SUBPREMISE_TYPES[normalized] || normalized;
}

/**
 * Normalize a premise type to its abbreviation
 */
export function normalizePremiseType(type: string): string {
  const normalized = toUpperLabel(stripAccents(type));
  return PREMISE_TYPES[normalized] || normalized;
}

/**
 * Check if a string is a valid thoroughfare type
 */
export function isThoroughfareType(s: string): boolean {
  const normalized = toUpperLabel(stripAccents(s));
  return normalized in THOROUGHFARE_TYPES;
}

/**
 * Check if a string is a valid sub-premise type
 */
export function isSubPremiseType(s: string): boolean {
  const normalized = toUpperLabel(stripAccents(s));
  return normalized in SUBPREMISE_TYPES;
}

/**
 * Get full name from abbreviation for thoroughfare types
 */
export function getThoroughfareFullName(abbrev: string): string | undefined {
  const normalized = toUpperLabel(abbrev);
  const entry = Object.entries(THOROUGHFARE_TYPES).find(
    ([_, v]) => v === normalized
  );
  return entry ? entry[0] : undefined;
}

/**
 * Get full name from abbreviation for sub-premise types
 */
export function getSubPremiseFullName(abbrev: string): string | undefined {
  const normalized = toUpperLabel(abbrev);
  const entry = Object.entries(SUBPREMISE_TYPES).find(
    ([_, v]) => v === normalized
  );
  return entry ? entry[0] : undefined;
}
