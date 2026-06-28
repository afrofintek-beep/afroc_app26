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
 * @module QGSQ Grid Engine Hook
 * @description Quadrant Grid / Sub-Quadrant system for African address identification
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface QGResult {
  afroloc: string;
  country: string;
  zone: 'urban' | 'rural';
  grid_m: number;
  tile_ix: number;
  tile_iy: number;
  bbox: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  };
  centroid: {
    lon: number;
    lat: number;
  };
  webMercator?: {
    x: number;
    y: number;
  };
  // Legacy compatibility
  qgCode?: string;
  cellX?: number;
  cellY?: number;
  cellSize?: number;
  cellType?: 'urban' | 'rural';
  bounds?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

export interface SQResult {
  sqCode: string;
  fullCode: string;
  subdivisionType: '2x2' | '3x3' | '4x4' | '5x5';
  subCellIndex: string;
  subCellBounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  densityMetrics: {
    certificationCount: number;
    estimatedPopulation: number;
    densityClass: 'low' | 'medium' | 'high' | 'very_high';
    growthRatePercent?: number;
    previousDensityClass?: string | null;
    lastCalculatedAt?: string;
    cacheHit?: boolean;
  };
}

export interface GridCell {
  qg: QGResult;
  sq?: SQResult;
  lat: number;
  lon: number;
}

// Transform new format to include legacy fields for backward compatibility
function transformQGResult(data: any): QGResult {
  return {
    ...data,
    // Legacy compatibility mappings
    qgCode: data.afroloc,
    cellX: data.tile_ix,
    cellY: data.tile_iy,
    cellSize: data.grid_m,
    cellType: data.zone,
    bounds: data.bbox ? {
      minLat: data.bbox.minLat,
      maxLat: data.bbox.maxLat,
      minLon: data.bbox.minLon,
      maxLon: data.bbox.maxLon,
    } : undefined,
  };
}

export function useQGSQEngine() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const computeQG = useCallback(async (
    latitude: number,
    longitude: number,
    countryCode: string,
    cellType?: 'urban' | 'rural' | 'auto',
    adminPath?: string
  ): Promise<QGResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('qg-engine', {
        body: { 
          latitude, 
          longitude, 
          countryCode, 
          cellType: cellType || 'auto',
          adminPath 
        }
      });

      if (fnError) throw fnError;
      return transformQGResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to compute QG';
      setError(message);
      console.error('QG Engine error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const decodeQG = useCallback(async (code: string): Promise<QGResult | null> => {
    setLoading(true);
    setError(null);

    try {
      // Clean the code: extract only the AFROLOC part (remove table formatting, extra text, etc.)
      // AFROLOC format: CC-XXX-XXX-XXX-G10-XXXX-NXXXX or CC-ZU-G10-XXXX-NXXXX
      let cleanCode = code.trim();
      
      // Remove common table formatting characters and text after the code
      // Split by common delimiters and take the first valid AFROLOC-looking part
      const possibleCodes = cleanCode.split(/[\s|,;]+/);
      const afrolocPattern = /^[A-Z]{2}(-[A-Z0-9]+)+$/i;
      
      for (const part of possibleCodes) {
        const trimmed = part.trim();
        if (trimmed && afrolocPattern.test(trimmed) && trimmed.includes('G')) {
          cleanCode = trimmed.toUpperCase();
          break;
        }
      }
      
      const { data, error: fnError } = await supabase.functions.invoke('qg-engine', {
        body: { code: cleanCode }
      });

      if (fnError) throw fnError;
      return transformQGResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to decode AFROLOC code';
      setError(message);
      console.error('QG Engine decode error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const computeSQ = useCallback(async (
    qgResult: QGResult,
    latitude: number,
    longitude: number,
    countryCode: string
  ): Promise<SQResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('sq-engine', {
        body: {
          qgCode: qgResult.afroloc || qgResult.qgCode,
          latitude,
          longitude,
          cellBounds: qgResult.bbox || qgResult.bounds,
          countryCode
        }
      });

      if (fnError) throw fnError;
      return data as SQResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to compute SQ';
      setError(message);
      console.error('SQ Engine error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const computeFullGrid = useCallback(async (
    latitude: number,
    longitude: number,
    countryCode: string,
    adminPath?: string
  ): Promise<GridCell | null> => {
    setLoading(true);
    setError(null);

    try {
      // First compute QG
      const qgResult = await computeQG(latitude, longitude, countryCode, 'auto', adminPath);
      if (!qgResult) return null;

      // Then compute SQ
      const sqResult = await computeSQ(qgResult, latitude, longitude, countryCode);

      return {
        qg: qgResult,
        sq: sqResult || undefined,
        lat: latitude,
        lon: longitude
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to compute grid';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [computeQG, computeSQ]);

  // Generate grid cells for a given bounding box (for visualization)
  const generateGridCells = useCallback(async (
    bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
    countryCode: string,
    maxCells: number = 100
  ): Promise<QGResult[]> => {
    setLoading(true);
    setError(null);

    try {
      const cells: QGResult[] = [];
      const seenCodes = new Set<string>();

      // Sample points within the bounds
      const latStep = (bounds.maxLat - bounds.minLat) / Math.sqrt(maxCells);
      const lonStep = (bounds.maxLon - bounds.minLon) / Math.sqrt(maxCells);

      for (let lat = bounds.minLat; lat <= bounds.maxLat && cells.length < maxCells; lat += latStep) {
        for (let lon = bounds.minLon; lon <= bounds.maxLon && cells.length < maxCells; lon += lonStep) {
          const qg = await computeQG(lat, lon, countryCode);
          const code = qg?.afroloc || qg?.qgCode;
          if (qg && code && !seenCodes.has(code)) {
            seenCodes.add(code);
            cells.push(qg);
          }
        }
      }

      return cells;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate grid';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [computeQG]);

  return {
    loading,
    error,
    computeQG,
    decodeQG,
    computeSQ,
    computeFullGrid,
    generateGridCells
  };
}
