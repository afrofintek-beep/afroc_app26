/**
 * AFROLOC Address Normalize Edge Function
 * Copyright © 2025 AFROFINTEK GmbH. All rights reserved.
 * 
 * Parses and normalizes free-form address input into structured AFROLOC format.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

// Thoroughfare type mappings (full name → abbreviation)
const THOROUGHFARE_TYPES: Record<string, string> = {
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

// Sub-premise type mappings
const SUBPREMISE_TYPES: Record<string, string> = {
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
  "ANDAR": "AND",
  "AND": "AND",
  "AND.": "AND",
  "BLOCO": "BL",
  "BL": "BL",
  "BL.": "BL",
};

interface NormalizeRequest {
  country_code?: string;
  input: string;
  hints?: {
    locality?: string;
    administrative_area?: string;
  };
}

interface NormalizationChange {
  field: string;
  original: string;
  normalized: string;
  rule: string;
}

interface Address {
  address_id: string;
  country_code: string;
  administrative_area?: string;
  locality?: string;
  dependent_locality?: string;
  thoroughfare_name?: string;
  thoroughfare_type?: string;
  thoroughfare_type_abbrev?: string;
  premise_number?: string;
  sub_premise_type?: string;
  sub_premise_id?: string;
  display: string;
  label: string;
  raw_input: string;
}

// Helper functions
function cleanSpaces(s: string): string {
  if (!s) return "";
  return s.replace(/\s+/g, " ").trim();
}

function toUpperLabel(s: string): string {
  if (!s) return "";
  return cleanSpaces(s).toUpperCase();
}

function stripAccents(s: string): string {
  if (!s) return "";
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function extractPremiseNumber(s: string): { text: string; number: string | null } {
  // Look for patterns like "Nº 123", "N.º 123", "nº123", "123", "#123"
  const patterns = [
    /[Nn][.º°]?\s*(\d+[A-Za-z]?)/,
    /#\s*(\d+[A-Za-z]?)/,
    /\b(\d+[A-Za-z]?)\b/,
  ];
  
  for (const pattern of patterns) {
    const match = s.match(pattern);
    if (match) {
      const number = match[1];
      const text = s.replace(match[0], "").trim();
      return { text: cleanSpaces(text), number };
    }
  }
  
  return { text: s, number: null };
}

function extractSubPremise(s: string): { text: string; type: string | null; typeAbbrev: string | null; id: string | null } {
  const upperS = toUpperLabel(stripAccents(s));
  
  for (const [fullType, abbrev] of Object.entries(SUBPREMISE_TYPES)) {
    const pattern = new RegExp(`\\b${fullType}[.:]?\\s*([A-Za-z0-9]+)`, "i");
    const match = upperS.match(pattern);
    if (match) {
      const originalMatch = s.match(new RegExp(`\\b${fullType}[.:]?\\s*[A-Za-z0-9]+`, "i"));
      const text = originalMatch ? s.replace(originalMatch[0], "").trim() : s;
      return { 
        text: cleanSpaces(text), 
        type: fullType, 
        typeAbbrev: abbrev, 
        id: match[1] 
      };
    }
  }
  
  return { text: s, type: null, typeAbbrev: null, id: null };
}

function extractThoroughfareType(s: string): { name: string; type: string | null; typeAbbrev: string | null } {
  const upperS = toUpperLabel(stripAccents(s));
  
  for (const [fullType, abbrev] of Object.entries(THOROUGHFARE_TYPES)) {
    const normalizedType = stripAccents(fullType);
    if (upperS.startsWith(normalizedType + " ") || upperS.startsWith(normalizedType + ".")) {
      const name = s.substring(fullType.length).replace(/^[.\s]+/, "").trim();
      return { name: cleanSpaces(name), type: fullType, typeAbbrev: abbrev };
    }
  }
  
  return { name: s, type: null, typeAbbrev: null };
}

function generateAddressId(countryCode: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `afroloc:${countryCode}-${timestamp}-${random}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: NormalizeRequest = await req.json();
    
    // Validate input
    if (!body.input || typeof body.input !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'input' field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const input = cleanSpaces(body.input);
    if (input.length === 0) {
      return new Response(
        JSON.stringify({ error: "Input cannot be empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const countryCode = (body.country_code || "XX").toUpperCase();
    const changes: NormalizationChange[] = [];

    // Split by commas for parsing
    const parts = input.split(",").map((p) => cleanSpaces(p)).filter((p) => p.length > 0);

    let thoroughfare_name: string | undefined;
    let thoroughfare_type: string | undefined;
    let thoroughfare_type_abbrev: string | undefined;
    let premise_number: string | undefined;
    let sub_premise_type: string | undefined;
    let sub_premise_id: string | undefined;
    let locality: string | undefined;
    let dependent_locality: string | undefined;
    let administrative_area: string | undefined;

    // Use hints if provided
    if (body.hints?.locality) {
      locality = cleanSpaces(body.hints.locality);
    }
    if (body.hints?.administrative_area) {
      administrative_area = cleanSpaces(body.hints.administrative_area);
    }

    // Process parts heuristically
    for (let i = 0; i < parts.length; i++) {
      let part = parts[i];
      
      // First part is usually the thoroughfare
      if (i === 0) {
        // Extract sub-premise if present in first part
        const subPremiseResult = extractSubPremise(part);
        if (subPremiseResult.type) {
          sub_premise_type = subPremiseResult.typeAbbrev || subPremiseResult.type;
          sub_premise_id = subPremiseResult.id || undefined;
          part = subPremiseResult.text;
          changes.push({
            field: "sub_premise",
            original: parts[i],
            normalized: `${sub_premise_type} ${sub_premise_id}`,
            rule: "subpremise_extraction"
          });
        }

        // Extract premise number
        const premiseResult = extractPremiseNumber(part);
        if (premiseResult.number) {
          premise_number = premiseResult.number;
          part = premiseResult.text;
          changes.push({
            field: "premise_number",
            original: parts[i],
            normalized: premise_number,
            rule: "premise_extraction"
          });
        }

        // Extract thoroughfare type
        const tfResult = extractThoroughfareType(part);
        thoroughfare_name = tfResult.name || part;
        if (tfResult.type) {
          thoroughfare_type = tfResult.type;
          thoroughfare_type_abbrev = tfResult.typeAbbrev || undefined;
          changes.push({
            field: "thoroughfare_type",
            original: tfResult.type,
            normalized: tfResult.typeAbbrev || tfResult.type,
            rule: "thoroughfare_mapping"
          });
        }
        continue;
      }

      // Check if this part contains sub-premise info
      const subPremiseCheck = extractSubPremise(part);
      if (subPremiseCheck.type && !sub_premise_type) {
        sub_premise_type = subPremiseCheck.typeAbbrev || subPremiseCheck.type;
        sub_premise_id = subPremiseCheck.id || undefined;
        part = subPremiseCheck.text;
        changes.push({
          field: "sub_premise",
          original: parts[i],
          normalized: `${sub_premise_type} ${sub_premise_id}`,
          rule: "subpremise_extraction"
        });
        if (!part) continue;
      }

      // Check if this part contains a number (might be premise)
      const premiseCheck = extractPremiseNumber(part);
      if (premiseCheck.number && !premise_number) {
        premise_number = premiseCheck.number;
        part = premiseCheck.text;
        changes.push({
          field: "premise_number",
          original: parts[i],
          normalized: premise_number,
          rule: "premise_extraction"
        });
        if (!part) continue;
      }

      // Remaining parts: dependent_locality, locality, administrative_area
      if (part) {
        if (!dependent_locality && !locality && !administrative_area) {
          dependent_locality = part;
        } else if (!locality && !body.hints?.locality) {
          locality = part;
        } else if (!administrative_area && !body.hints?.administrative_area) {
          administrative_area = part;
        }
      }
    }

    // Build display string (preserving original casing and accents)
    const displayParts: string[] = [];
    if (thoroughfare_type && thoroughfare_name) {
      displayParts.push(`${thoroughfare_type} ${thoroughfare_name}`);
    } else if (thoroughfare_name) {
      displayParts.push(thoroughfare_name);
    }
    if (premise_number) displayParts.push(`Nº ${premise_number}`);
    if (sub_premise_type && sub_premise_id) displayParts.push(`${sub_premise_type} ${sub_premise_id}`);
    if (dependent_locality) displayParts.push(dependent_locality);
    if (locality) displayParts.push(locality);
    if (administrative_area) displayParts.push(administrative_area);

    const display = displayParts.join(", ");

    // Build label (normalized, uppercase, no accents)
    const labelParts: string[] = [];
    if (thoroughfare_type_abbrev && thoroughfare_name) {
      labelParts.push(`${thoroughfare_type_abbrev} ${stripAccents(toUpperLabel(thoroughfare_name))}`);
    } else if (thoroughfare_name) {
      labelParts.push(stripAccents(toUpperLabel(thoroughfare_name)));
    }
    if (premise_number) labelParts.push(premise_number);
    if (sub_premise_type && sub_premise_id) labelParts.push(`${sub_premise_type} ${sub_premise_id}`);
    if (dependent_locality) labelParts.push(stripAccents(toUpperLabel(dependent_locality)));
    if (locality) labelParts.push(stripAccents(toUpperLabel(locality)));
    if (administrative_area) labelParts.push(stripAccents(toUpperLabel(administrative_area)));
    labelParts.push(countryCode);

    const label = labelParts.join(" - ");

    // Generate address_id
    const address_id = generateAddressId(countryCode);

    // Build address object
    const address: Address = {
      address_id,
      country_code: countryCode,
      administrative_area,
      locality,
      dependent_locality,
      thoroughfare_name,
      thoroughfare_type,
      thoroughfare_type_abbrev,
      premise_number,
      sub_premise_type,
      sub_premise_id,
      display,
      label,
      raw_input: body.input,
    };

    // Track space normalization if any
    if (input !== body.input) {
      changes.push({
        field: "input",
        original: body.input,
        normalized: input,
        rule: "space_normalization"
      });
    }

    return new Response(
      JSON.stringify({ address, changes }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Normalize error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
