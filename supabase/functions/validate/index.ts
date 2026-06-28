/**
 * AFROLOC Address Validate Edge Function
 * Copyright © 2025 AFROFINTEK GmbH. All rights reserved.
 * 
 * Validates address objects against AFROLOC rules.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

// Known thoroughfare types
const THOROUGHFARE_TYPES: Record<string, string> = {
  "AVENIDA": "AV",
  "AV.": "AV",
  "AV": "AV",
  "RUA": "R",
  "R.": "R",
  "R": "R",
  "TRAVESSA": "TR",
  "TRAV.": "TR",
  "TRAV": "TR",
  "TR": "TR",
  "PRAÇA": "PC",
  "PRACA": "PC",
  "PÇ.": "PC",
  "PÇ": "PC",
  "PC": "PC",
  "ALAMEDA": "AL",
  "AL.": "AL",
  "AL": "AL",
  "LARGO": "LG",
  "LG.": "LG",
  "LG": "LG",
  "ESTRADA": "EST",
  "EST.": "EST",
  "EST": "EST",
  "BECO": "BC",
  "BC.": "BC",
  "BC": "BC",
  "CAMINHO": "CAM",
  "CAM.": "CAM",
  "CAM": "CAM",
  "ROTUNDA": "ROT",
  "ROT.": "ROT",
  "ROT": "ROT",
};

// Geographic bounds (approximate world bounds)
const GEO_BOUNDS = {
  lat: { min: -90, max: 90 },
  lon: { min: -180, max: 180 },
};

interface Address {
  address_id?: string;
  country_code?: string;
  administrative_area?: string;
  locality?: string;
  dependent_locality?: string;
  thoroughfare_name?: string;
  thoroughfare_type?: string;
  thoroughfare_type_abbrev?: string;
  premise_number?: string;
  building_name?: string;
  sub_premise_type?: string;
  sub_premise_id?: string;
  post_code?: string;
  place_name?: string;
  lat?: number;
  lon?: number;
  tile_id?: string;
  precision_level?: string;
  display?: string;
  label?: string;
  raw_input?: string;
}

interface ValidationError {
  code: string;
  field: string;
  message: string;
}

interface ValidationWarning {
  code: string;
  field: string;
  message: string;
}

interface ValidateResponse {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

function stripAccents(s: string): string {
  if (!s) return "";
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isKnownThoroughfareType(type: string): boolean {
  if (!type) return false;
  const normalized = stripAccents(type.toUpperCase().trim());
  return normalized in THOROUGHFARE_TYPES;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const address: Address = await req.json();
    
    // Validate that we received an object
    if (!address || typeof address !== "object") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid address object" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // ========== ERRORS ==========

    // E_COUNTRY_INVALID: country_code must be exactly 2 letters
    if (!address.country_code) {
      errors.push({
        code: "E_COUNTRY_INVALID",
        field: "country_code",
        message: "Country code is required",
      });
    } else if (!/^[A-Za-z]{2}$/.test(address.country_code)) {
      errors.push({
        code: "E_COUNTRY_INVALID",
        field: "country_code",
        message: "Country code must be exactly 2 letters (ISO 3166-1 alpha-2)",
      });
    }

    // E_GEO_OUT_OF_RANGE: lat/lon out of valid bounds
    if (address.lat !== undefined && address.lat !== null) {
      if (typeof address.lat !== "number" || address.lat < GEO_BOUNDS.lat.min || address.lat > GEO_BOUNDS.lat.max) {
        errors.push({
          code: "E_GEO_OUT_OF_RANGE",
          field: "lat",
          message: `Latitude must be between ${GEO_BOUNDS.lat.min} and ${GEO_BOUNDS.lat.max}`,
        });
      }
    }

    if (address.lon !== undefined && address.lon !== null) {
      if (typeof address.lon !== "number" || address.lon < GEO_BOUNDS.lon.min || address.lon > GEO_BOUNDS.lon.max) {
        errors.push({
          code: "E_GEO_OUT_OF_RANGE",
          field: "lon",
          message: `Longitude must be between ${GEO_BOUNDS.lon.min} and ${GEO_BOUNDS.lon.max}`,
        });
      }
    }

    // E_MIN_COMPONENTS: Need either (locality AND geo) OR (thoroughfare_name AND premise_number)
    const hasLocality = !!address.locality?.trim();
    const hasGeo = address.lat !== undefined && address.lat !== null && 
                   address.lon !== undefined && address.lon !== null;
    const hasThoroughfareName = !!address.thoroughfare_name?.trim();
    const hasPremiseNumber = !!address.premise_number?.trim();

    const hasLocationGroup = hasLocality && hasGeo;
    const hasAddressGroup = hasThoroughfareName && hasPremiseNumber;

    if (!hasLocationGroup && !hasAddressGroup) {
      errors.push({
        code: "E_MIN_COMPONENTS",
        field: "address",
        message: "Address must have either (locality AND coordinates) or (thoroughfare name AND premise number)",
      });
    }

    // ========== WARNINGS ==========

    // W_MISSING_POSTCODE: post_code is empty
    if (!address.post_code?.trim()) {
      warnings.push({
        code: "W_MISSING_POSTCODE",
        field: "post_code",
        message: "Post code is missing - recommended for delivery accuracy",
      });
    }

    // W_UNK_THOROUGHFARE_TYPE: thoroughfare type not in known enums
    if (address.thoroughfare_type && !isKnownThoroughfareType(address.thoroughfare_type)) {
      warnings.push({
        code: "W_UNK_THOROUGHFARE_TYPE",
        field: "thoroughfare_type",
        message: `Unknown thoroughfare type: '${address.thoroughfare_type}' - consider using standard types like RUA, AVENIDA, TRAVESSA`,
      });
    }

    // Also check abbreviation if provided
    if (address.thoroughfare_type_abbrev && !isKnownThoroughfareType(address.thoroughfare_type_abbrev)) {
      warnings.push({
        code: "W_UNK_THOROUGHFARE_TYPE",
        field: "thoroughfare_type_abbrev",
        message: `Unknown thoroughfare type abbreviation: '${address.thoroughfare_type_abbrev}'`,
      });
    }

    // W_LOW_PRECISION: precision_level is empty
    if (!address.precision_level?.trim()) {
      warnings.push({
        code: "W_LOW_PRECISION",
        field: "precision_level",
        message: "Precision level is not specified - address quality may be reduced",
      });
    }

    // Build response
    const response: ValidateResponse = {
      valid: errors.length === 0,
      errors,
      warnings,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Validate error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
