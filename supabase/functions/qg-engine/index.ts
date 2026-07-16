/**
 * AFROLOC Edge Function
 *
 * Copyright (c) 2024-2026 AFROFINTEK GmbH. All rights reserved.
 *
 * This file is part of the AFROLOC backend infrastructure.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited.
 *
 * For API documentation, see: /v1-docs
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";
import {
  encodeAfroloc,
  decodeAfroloc,
  validateAfrolocCode,
  type QGRequest,
} from "../_shared/afroloc_code.ts";

/**
 * AFROLOC QG ENGINE — NATIONAL GEOSPATIAL GRID
 *
 * NOMENCLATURA OFICIAL:
 * CC-PROV-MUN-COM-BAI-G10-X-Y (com hierarquia administrativa)
 *
 * Onde:
 * - CC: Código do país (2 letras ISO)
 * - PROV: Código da província (3 letras)
 * - MUN: Código do município (3 letras)
 * - COM: Código da comuna (3 letras)
 * - BAI: Código do bairro (3 letras)
 * - G10/G25: Tamanho da célula (10m urbano, 25m rural)
 * - X: Coordenada X em base36 (prefixo N para negativos)
 * - Y: Coordenada Y em base36 (prefixo N para negativos)
 *
 * Formato alternativo sem hierarquia completa:
 * CC-ZU-G10-X-Y (legacy, ainda suportado para compatibilidade)
 *
 * WGS84 lat/lon -> WebMercator meters -> tile indices
 * Urban: 10m | Rural: 25m
 *
 * O codec vive em `_shared/afroloc_code.ts` (implementação ÚNICA,
 * partilhada com o yamioo-gateway). Este ficheiro é só o handler HTTP.
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Check if this is a validate-only request
    if (body.action === 'validate' && body.code) {
      console.log(`QG Engine: Validating ${body.code}`);
      const validation = validateAfrolocCode(body.code);

      console.log(`QG Engine: Validation result - valid: ${validation.valid}, format: ${validation.format}`);

      return new Response(
        JSON.stringify(validation),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a decode request
    if (body.code && !body.latitude) {
      console.log(`QG Engine: Decoding ${body.code}`);
      const result = decodeAfroloc(body.code);

      if (result.wasConverted) {
        console.log(`QG Engine: Converted from ${result.originalFormat} format to ${result.afroloc}`);
      }
      console.log(`QG Engine: Decoded to centroid ${result.centroid.lat}, ${result.centroid.lon} (format: ${result.format})`);

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Encode request
    const request: QGRequest = body;

    // Validate input - GPS is mandatory
    if (request.latitude === undefined || request.longitude === undefined) {
      return new Response(
        JSON.stringify({ error: 'GPS coordinates are mandatory: latitude and longitude are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!request.countryCode) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: countryCode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate coordinates
    if (request.latitude < -90 || request.latitude > 90) {
      return new Response(
        JSON.stringify({ error: 'Invalid latitude: must be between -90 and 90' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (request.longitude < -180 || request.longitude > 180) {
      return new Response(
        JSON.stringify({ error: 'Invalid longitude: must be between -180 and 180' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminInfo = [
      request.municipalityCode,
      request.communeCode,
      request.neighborhoodCode
    ].filter(Boolean).join('/') || 'no-admin';

    console.log(`QG Engine: Encoding ${request.countryCode} @ ${request.latitude}, ${request.longitude} (admin: ${adminInfo})`);

    const result = encodeAfroloc(request);

    console.log(`QG Engine: Generated code ${result.afroloc} (${result.zone}, ${result.grid_m}m)`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = (error as Error)?.message || 'Unknown error';
    console.error('QG Engine error:', error);

    const isClientError =
      message.startsWith('Invalid') ||
      message.startsWith('Incomplete') ||
      message.startsWith('Legacy') ||
      message.startsWith('GPS') ||
      message.startsWith('Missing') ||
      message.includes('must be');

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: isClientError ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
