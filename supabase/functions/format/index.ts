/**
 * AFROLOC Address Format Edge Function
 * Copyright © 2025 AFROFINTEK GmbH. All rights reserved.
 * 
 * Formats address objects into postal label lines by country template.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

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

interface DeliveryChannel {
  operator_code: string;
  operator_name: string;
  point_type: "po_box" | "locker" | "pickup";
  point_code: string;
  point_name?: string;
  point_address?: string;
}

interface FormatRequest {
  address: Address;
  country?: string;
  delivery_channel?: DeliveryChannel;
}

interface FormatResponse {
  lines: string[];
  lines_physical: string[];
  lines_delivery: string[];
  country: string;
  template_id: string;
  has_delivery_channel: boolean;
}

// Country names mapping
const COUNTRY_NAMES: Record<string, string> = {
  "AO": "ANGOLA",
  "NA": "NAMIBIA",
  "ZA": "SOUTH AFRICA",
  "PT": "PORTUGAL",
};

// Template IDs
const TEMPLATE_IDS: Record<string, string> = {
  "AO": "afroloc-ao-v1",
  "NA": "afroloc-na-v1",
  "ZA": "afroloc-za-v1",
  "PT": "afroloc-pt-v1",
};

function stripAccents(s: string): string {
  if (!s) return "";
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function toUpperClean(s: string | undefined): string {
  if (!s) return "";
  return stripAccents(s.trim()).toUpperCase();
}

function buildThoroughfareLine(address: Address): string {
  const parts: string[] = [];
  
  // Use abbreviation if available, otherwise type, otherwise just name
  if (address.thoroughfare_type_abbrev) {
    parts.push(toUpperClean(address.thoroughfare_type_abbrev));
  } else if (address.thoroughfare_type) {
    parts.push(toUpperClean(address.thoroughfare_type));
  }
  
  if (address.thoroughfare_name) {
    parts.push(toUpperClean(address.thoroughfare_name));
  }
  
  return parts.join(" ");
}

function buildSubPremiseLine(address: Address): string {
  const parts: string[] = [];
  
  if (address.building_name) {
    parts.push(toUpperClean(address.building_name));
  }
  
  if (address.sub_premise_type && address.sub_premise_id) {
    parts.push(`${toUpperClean(address.sub_premise_type)} ${toUpperClean(address.sub_premise_id)}`);
  } else if (address.sub_premise_type) {
    parts.push(toUpperClean(address.sub_premise_type));
  } else if (address.sub_premise_id) {
    parts.push(toUpperClean(address.sub_premise_id));
  }
  
  return parts.join(", ");
}

function formatAO(address: Address): string[] {
  const lines: string[] = [];
  
  // Line 1: BUILDING_NAME + ", " + SUBPREMISE (if exists)
  const subPremiseLine = buildSubPremiseLine(address);
  if (subPremiseLine) {
    lines.push(subPremiseLine);
  }
  
  // Line 2: THOROUGHFARE + ", " + PREMISE_NUMBER
  const thoroughfare = buildThoroughfareLine(address);
  if (thoroughfare || address.premise_number) {
    const tfParts: string[] = [];
    if (thoroughfare) tfParts.push(thoroughfare);
    if (address.premise_number) tfParts.push(`Nº ${toUpperClean(address.premise_number)}`);
    lines.push(tfParts.join(", "));
  }
  
  // Line 3: DEPENDENT_LOCALITY
  if (address.dependent_locality) {
    lines.push(toUpperClean(address.dependent_locality));
  }
  
  // Line 4: LOCALITY
  if (address.locality) {
    lines.push(toUpperClean(address.locality));
  }
  
  // Line 5: POST_CODE
  if (address.post_code) {
    lines.push(toUpperClean(address.post_code));
  }
  
  // Line 6: ANGOLA
  lines.push("ANGOLA");
  
  return lines.filter(l => l.length > 0);
}

function formatNA(address: Address): string[] {
  const lines: string[] = [];
  
  // Similar to AO template
  const subPremiseLine = buildSubPremiseLine(address);
  if (subPremiseLine) {
    lines.push(subPremiseLine);
  }
  
  const thoroughfare = buildThoroughfareLine(address);
  if (thoroughfare || address.premise_number) {
    const tfParts: string[] = [];
    if (thoroughfare) tfParts.push(thoroughfare);
    if (address.premise_number) tfParts.push(`NO. ${toUpperClean(address.premise_number)}`);
    lines.push(tfParts.join(", "));
  }
  
  if (address.dependent_locality) {
    lines.push(toUpperClean(address.dependent_locality));
  }
  
  if (address.locality) {
    lines.push(toUpperClean(address.locality));
  }
  
  if (address.post_code) {
    lines.push(toUpperClean(address.post_code));
  }
  
  lines.push("NAMIBIA");
  
  return lines.filter(l => l.length > 0);
}

function formatZA(address: Address): string[] {
  const lines: string[] = [];
  
  // Similar to AO template
  const subPremiseLine = buildSubPremiseLine(address);
  if (subPremiseLine) {
    lines.push(subPremiseLine);
  }
  
  const thoroughfare = buildThoroughfareLine(address);
  if (thoroughfare || address.premise_number) {
    const tfParts: string[] = [];
    if (address.premise_number) tfParts.push(toUpperClean(address.premise_number));
    if (thoroughfare) tfParts.push(thoroughfare);
    lines.push(tfParts.join(" "));
  }
  
  if (address.dependent_locality) {
    lines.push(toUpperClean(address.dependent_locality));
  }
  
  if (address.locality) {
    lines.push(toUpperClean(address.locality));
  }
  
  if (address.post_code) {
    lines.push(toUpperClean(address.post_code));
  }
  
  lines.push("SOUTH AFRICA");
  
  return lines.filter(l => l.length > 0);
}

function formatPT(address: Address): string[] {
  const lines: string[] = [];
  
  // Similar to AO but post_code before locality
  const subPremiseLine = buildSubPremiseLine(address);
  if (subPremiseLine) {
    lines.push(subPremiseLine);
  }
  
  const thoroughfare = buildThoroughfareLine(address);
  if (thoroughfare || address.premise_number) {
    const tfParts: string[] = [];
    if (thoroughfare) tfParts.push(thoroughfare);
    if (address.premise_number) tfParts.push(`Nº ${toUpperClean(address.premise_number)}`);
    lines.push(tfParts.join(", "));
  }
  
  if (address.dependent_locality) {
    lines.push(toUpperClean(address.dependent_locality));
  }
  
  // PT format: POST_CODE before LOCALITY
  if (address.post_code && address.locality) {
    lines.push(`${toUpperClean(address.post_code)} ${toUpperClean(address.locality)}`);
  } else if (address.post_code) {
    lines.push(toUpperClean(address.post_code));
  } else if (address.locality) {
    lines.push(toUpperClean(address.locality));
  }
  
  lines.push("PORTUGAL");
  
  return lines.filter(l => l.length > 0);
}

// Format delivery channel lines
function formatDeliveryChannel(channel: DeliveryChannel): string[] {
  const lines: string[] = [];
  
  // Line 1: Operator name
  lines.push(toUpperClean(channel.operator_name));
  
  // Line 2: Point type and code
  const pointTypeLabels: Record<string, string> = {
    "po_box": "CAIXA POSTAL",
    "locker": "LOCKER",
    "pickup": "PONTO DE RECOLHA",
  };
  const typeLabel = pointTypeLabels[channel.point_type] || channel.point_type.toUpperCase();
  lines.push(`${typeLabel}: ${toUpperClean(channel.point_code)}`);
  
  // Line 3: Point name if available
  if (channel.point_name) {
    lines.push(toUpperClean(channel.point_name));
  }
  
  // Line 4: Point address if available
  if (channel.point_address) {
    lines.push(toUpperClean(channel.point_address));
  }
  
  return lines.filter(l => l.length > 0);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: FormatRequest = await req.json();
    
    // Validate input
    if (!body.address || typeof body.address !== "object") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'address' field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine country - use query param, then address field, then default to XX
    const countryCode = (body.country || body.address.country_code || "XX").toUpperCase();
    
    // Validate country code
    if (!["AO", "NA", "ZA", "PT"].includes(countryCode)) {
      return new Response(
        JSON.stringify({ 
          error: "Unsupported country code", 
          details: `Country '${countryCode}' is not supported. Use AO, NA, ZA, or PT.` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format based on country
    let physicalLines: string[];
    switch (countryCode) {
      case "AO":
        physicalLines = formatAO(body.address);
        break;
      case "NA":
        physicalLines = formatNA(body.address);
        break;
      case "ZA":
        physicalLines = formatZA(body.address);
        break;
      case "PT":
        physicalLines = formatPT(body.address);
        break;
      default:
        physicalLines = formatAO(body.address); // Fallback to AO template
    }

    // Format delivery channel if provided
    const hasDeliveryChannel = !!body.delivery_channel;
    const deliveryLines = hasDeliveryChannel 
      ? formatDeliveryChannel(body.delivery_channel!)
      : [];

    // Primary lines: use delivery if available, otherwise physical
    const primaryLines = hasDeliveryChannel ? deliveryLines : physicalLines;

    const response: FormatResponse = {
      lines: primaryLines,
      lines_physical: physicalLines,
      lines_delivery: deliveryLines,
      country: COUNTRY_NAMES[countryCode] || countryCode,
      template_id: TEMPLATE_IDS[countryCode] || "afroloc-default-v1",
      has_delivery_channel: hasDeliveryChannel,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Format error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
