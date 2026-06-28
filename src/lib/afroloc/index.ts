/**
 * AFROLOC Address Core Module
 * Copyright © 2025 AFROFINTEK GmbH. All rights reserved.
 * 
 * Core library for address normalization, validation, and formatting.
 * For geospatial encode/decode/resolve, use '@/lib/afroloc/sdk'.
 */

// Re-export SDK for convenience
export { encode, decode, validate as validateCode, resolve, batchResolve, distance, deepLink, isAfricanCountry, SDK } from './sdk';
export type { EncodeResult, DecodeResult, ValidateResult, BatchResolveResult, Zone, ResolveOptions } from './sdk';

// Export types
export type {
  Address,
  GeoRef,
  Thoroughfare,
  Premise,
  SubPremise,
  ValidateResponse,
  ValidationError,
  ValidationWarning,
  NormalizeResponse,
  NormalizationChange,
  FormatOptions,
  FormatResponse,
} from "./addressTypes";

// Export rules and helpers
export {
  THOROUGHFARE_TYPES,
  SUBPREMISE_TYPES,
  PREMISE_TYPES,
  cleanSpaces,
  toUpperLabel,
  stripAccents,
  normalizeThoroughfareType,
  normalizeSubPremiseType,
  normalizePremiseType,
  isThoroughfareType,
  isSubPremiseType,
  getThoroughfareFullName,
  getSubPremiseFullName,
} from "./rules";

// Import types + rules helpers for the implementations below
import type {
  Address,
  Thoroughfare,
  Premise,
  SubPremise,
  ValidateResponse,
  NormalizeResponse,
  NormalizationChange,
  FormatOptions,
  FormatResponse,
} from "./addressTypes";
import {
  THOROUGHFARE_TYPES,
  SUBPREMISE_TYPES,
  cleanSpaces,
  toUpperLabel,
  stripAccents,
  isThoroughfareType,
} from "./rules";

/**
 * Normalize an address string or object to standard AFROLOC format
 * @param input - Raw address string or partial Address object
 * @returns NormalizeResponse with normalized address and changes made
 */
export function normalize(input: string | Partial<Address>): NormalizeResponse {
  const originalInput = typeof input === "string" ? input : JSON.stringify(input);

  // Structured input → normalise the labelled fields in place.
  if (typeof input !== "string") {
    const changes: NormalizationChange[] = [];
    const normalized: Address = {
      ...(input as Address),
      country: input.country ?? "",
      countryCode: (input.countryCode ?? "").toUpperCase(),
      rawInput: originalInput,
    };
    if (input.thoroughfare?.type) {
      const abbrev = THOROUGHFARE_TYPES[toUpperLabel(stripAccents(input.thoroughfare.type))];
      if (abbrev && abbrev !== input.thoroughfare.typeAbbrev) {
        changes.push({ field: "thoroughfare.type", original: input.thoroughfare.type, normalized: abbrev, rule: "thoroughfare_mapping" });
        normalized.thoroughfare = { ...input.thoroughfare, typeAbbrev: abbrev };
      }
    }
    return { success: true, normalized, changes, originalInput };
  }

  // Free-form string → heuristic parser (mirrors the `normalize` edge function).
  const changes: NormalizationChange[] = [];
  const cleaned = cleanSpaces(input);
  if (cleaned !== input) {
    changes.push({ field: "input", original: input, normalized: cleaned, rule: "space_normalization" });
  }

  const parts = cleaned.split(",").map(cleanSpaces).filter(Boolean);
  let thoroughfare: Thoroughfare | undefined;
  let premise: Premise | undefined;
  let subPremise: SubPremise | undefined;
  const localities: string[] = [];

  parts.forEach((rawPart, i) => {
    let part = rawPart;

    // Sub-premise (apartamento, loja, andar…)
    const sp = extractSubPremise(part);
    if (sp && !subPremise) {
      subPremise = { type: sp.fullType, typeAbbrev: sp.abbrev, identifier: sp.id };
      part = sp.rest;
      changes.push({ field: "subPremise", original: rawPart, normalized: `${sp.abbrev} ${sp.id}`, rule: "subpremise_extraction" });
    }

    // Premise number (Nº 123, #123…)
    const pr = extractPremiseNumber(part);
    if (pr.number && !premise) {
      premise = { number: pr.number };
      part = pr.rest;
      changes.push({ field: "premise", original: rawPart, normalized: pr.number, rule: "premise_extraction" });
    }

    if (i === 0 && part) {
      // First part is the thoroughfare (street type + name).
      const tf = extractThoroughfareType(part);
      thoroughfare = {
        type: tf.fullType ?? "",
        typeAbbrev: tf.abbrev ?? undefined,
        name: tf.name,
        fullName: tf.fullType ? `${tf.fullType} ${tf.name}` : tf.name,
      };
      if (tf.fullType) {
        changes.push({ field: "thoroughfare.type", original: tf.fullType, normalized: tf.abbrev ?? tf.fullType, rule: "thoroughfare_mapping" });
      }
    } else if (part) {
      localities.push(part);
    }
  });

  // Remaining parts → bairro (level4) · comuna (level3) · município (level2).
  const normalized: Address = {
    country: "",
    countryCode: "",
    thoroughfare,
    premise,
    subPremise,
    level4: localities[0] ? { code: "", name: localities[0] } : undefined,
    level3: localities[1] ? { code: "", name: localities[1] } : undefined,
    level2: localities[2] ? { code: "", name: localities[2] } : undefined,
    rawInput: input,
  };

  return { success: true, normalized, changes, originalInput };
}

// ─── Parser helpers (espelham a edge function `normalize`) ──────────────
function extractPremiseNumber(s: string): { rest: string; number: string | null } {
  const patterns = [/[Nn][.º°]?\s*(\d+[A-Za-z]?)/, /#\s*(\d+[A-Za-z]?)/, /\b(\d+[A-Za-z]?)\b/];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return { rest: cleanSpaces(s.replace(m[0], "")), number: m[1] };
  }
  return { rest: s, number: null };
}

function extractSubPremise(s: string): { rest: string; fullType: string; abbrev: string; id: string } | null {
  const up = toUpperLabel(stripAccents(s));
  for (const [fullType, abbrev] of Object.entries(SUBPREMISE_TYPES)) {
    const re = new RegExp(`\\b${stripAccents(fullType)}[.:]?\\s*([A-Za-z0-9]+)`, "i");
    const m = up.match(re);
    if (m) {
      const orig = s.match(new RegExp(`\\b${fullType}[.:]?\\s*[A-Za-z0-9]+`, "i"));
      return { rest: orig ? cleanSpaces(s.replace(orig[0], "")) : s, fullType, abbrev, id: m[1] };
    }
  }
  return null;
}

function extractThoroughfareType(s: string): { name: string; fullType: string | null; abbrev: string | null } {
  const up = toUpperLabel(stripAccents(s));
  for (const [fullType, abbrev] of Object.entries(THOROUGHFARE_TYPES)) {
    const nt = stripAccents(fullType);
    if (up.startsWith(nt + " ") || up.startsWith(nt + ".")) {
      const name = cleanSpaces(s.substring(fullType.length).replace(/^[.\s]+/, ""));
      return { name, fullType, abbrev };
    }
  }
  return { name: cleanSpaces(s), fullType: null, abbrev: null };
}

/**
 * Validate an address for completeness and correctness
 * @param address - Address object to validate
 * @returns ValidateResponse with validation results
 */
export function validate(address: Address): ValidateResponse {
  const errors: ValidateResponse["errors"] = [];
  const warnings: ValidateResponse["warnings"] = [];

  // ── Errors ──
  // E_COUNTRY_INVALID — country code obrigatório, exatamente 2 letras (ISO 3166-1).
  if (!address.countryCode) {
    errors.push({ field: "countryCode", code: "E_COUNTRY_INVALID", message: "Country code is required" });
  } else if (!/^[A-Za-z]{2}$/.test(address.countryCode)) {
    errors.push({ field: "countryCode", code: "E_COUNTRY_INVALID", message: "Country code must be exactly 2 letters (ISO 3166-1 alpha-2)" });
  }

  // E_GEO_OUT_OF_RANGE — coordenadas dentro dos limites.
  const geo = address.geoRef;
  if (geo?.latitude != null && (typeof geo.latitude !== "number" || geo.latitude < -90 || geo.latitude > 90)) {
    errors.push({ field: "geoRef.latitude", code: "E_GEO_OUT_OF_RANGE", message: "Latitude must be between -90 and 90" });
  }
  if (geo?.longitude != null && (typeof geo.longitude !== "number" || geo.longitude < -180 || geo.longitude > 180)) {
    errors.push({ field: "geoRef.longitude", code: "E_GEO_OUT_OF_RANGE", message: "Longitude must be between -180 and 180" });
  }

  // E_MIN_COMPONENTS — (localidade E geo) OU (rua E número).
  const hasLocality = !!(address.level4?.name?.trim() || address.level3?.name?.trim() || address.level2?.name?.trim());
  const hasGeo = geo?.latitude != null && geo?.longitude != null;
  const hasThoroughfare = !!address.thoroughfare?.name?.trim();
  const hasNumber = !!address.premise?.number?.trim();
  if (!(hasLocality && hasGeo) && !(hasThoroughfare && hasNumber)) {
    errors.push({
      field: "address",
      code: "E_MIN_COMPONENTS",
      message: "Address must have either (locality AND coordinates) or (thoroughfare name AND premise number)",
    });
  }

  // ── Warnings ──
  if (!address.postalCode?.trim()) {
    warnings.push({ field: "postalCode", code: "W_MISSING_POSTCODE", message: "Post code is missing — recommended for delivery accuracy" });
  }
  const tfType = address.thoroughfare?.type || address.thoroughfare?.typeAbbrev;
  if (tfType && !isThoroughfareType(tfType)) {
    warnings.push({ field: "thoroughfare.type", code: "W_UNK_THOROUGHFARE_TYPE", message: `Unknown thoroughfare type: '${tfType}' — use RUA, AVENIDA, TRAVESSA…` });
  }
  if (!hasGeo) {
    warnings.push({ field: "geoRef", code: "W_LOW_PRECISION", message: "No geo reference — address precision may be reduced" });
  }

  // Confiança (0–1): base + bónus por sinais presentes.
  let confidence = 0;
  if (errors.length === 0) {
    confidence = 0.4;
    if (hasGeo) confidence += 0.2;
    if (hasThoroughfare) confidence += 0.1;
    if (hasNumber) confidence += 0.1;
    if (hasLocality) confidence += 0.1;
    if (address.code) confidence += 0.1;
    confidence = Math.min(1, Number(confidence.toFixed(2)));
  }

  return { isValid: errors.length === 0, errors, warnings, confidence, suggestions: [] };
}

/**
 * Format an address for display
 * @param address - Address object to format
 * @param options - Formatting options
 * @returns FormatResponse with formatted address string
 */
export function formatAddress(
  address: Address,
  options: FormatOptions = { style: "full" }
): FormatResponse {
  const lines: string[] = [];

  // Build address lines based on style
  if (options.style === "code" && address.code) {
    return {
      success: true,
      formatted: address.code,
      style: options.style,
      lines: [address.code],
    };
  }

  // Estilo "short": só rua+número (ou localidade) + país.
  if (options.style === "short") {
    const head = address.thoroughfare
      ? `${address.thoroughfare.typeAbbrev || address.thoroughfare.type} ${address.thoroughfare.name}${address.premise ? ` ${address.premise.number}` : ""}`.trim()
      : address.level3?.name || address.level2?.name || "";
    const short = [head, address.level2?.name, options.includeCountry !== false ? address.country : undefined]
      .filter(Boolean)
      .join(", ");
    return { success: true, formatted: options.uppercase ? short.toUpperCase() : short, style: options.style, lines: [short] };
  }

  // Basic formatting
  if (address.thoroughfare) {
    const tfLine = address.thoroughfare.fullName || 
      `${address.thoroughfare.typeAbbrev || address.thoroughfare.type} ${address.thoroughfare.name}`;
    lines.push(tfLine);
  }

  if (address.premise) {
    lines.push(`Nº ${address.premise.number}`);
  }

  if (address.subPremise) {
    lines.push(`${address.subPremise.typeAbbrev || address.subPremise.type} ${address.subPremise.identifier}`);
  }

  if (address.level4?.name) lines.push(address.level4.name);
  if (address.level3?.name) lines.push(address.level3.name);
  if (address.level2?.name) lines.push(address.level2.name);
  if (address.level1?.name) lines.push(address.level1.name);
  
  if (options.includeCountry !== false && address.country) {
    lines.push(address.country);
  }

  const separator = options.style === "oneline" ? ", " : "\n";
  const formatted = lines.join(separator);

  return {
    success: true,
    formatted: options.uppercase ? formatted.toUpperCase() : formatted,
    style: options.style,
    lines,
  };
}
