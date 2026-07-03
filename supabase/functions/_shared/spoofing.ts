// AFROLOC — deteção de GPS spoofing (SERVER-SIDE, autoritativa).
//
// Copyright (c) 2024-2026 AFROFINTEK GmbH. Proprietary.
//
// Portado do antigo detetor client-side (src/utils/gpsSpoofingDetection.ts) para
// o servidor, onde NÃO pode ser contornado nem inspecionado. O cliente deixa de
// executar a deteção — só mostra o veredito que o servidor devolve/persiste.
//
// Baseado no AFRO ID Operational Handbook — Cap. 4.5 & 10.10.

export type SpoofRiskLevel = "none" | "low" | "medium" | "high" | "critical";

export interface SpoofingInput {
  deviceLat?: number | null;
  deviceLon?: number | null;
  deviceAccuracy?: number | null; // metros
  exifLat?: number | null;
  exifLon?: number | null;
  exifTimestamp?: string | null;  // ISO ou EXIF
  referenceTimestamp?: string | null; // momento do registo/captura (default: agora)
  previousLat?: number | null;
  previousLon?: number | null;
  secondsSinceLastCapture?: number | null;
}

export interface SpoofingVerdict {
  isSuspicious: boolean;
  riskLevel: SpoofRiskLevel;
  riskScore: number;   // 0-100
  alertCodes: string[]; // ex.: ["GPS_EXIF_MAJOR_MISMATCH", "IMPOSSIBLE_MOVEMENT"]
}

/** Haversine — distância em metros. */
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Deteção autoritativa de spoofing. Mesmos limiares da versão histórica. */
export function detectSpoofing(input: SpoofingInput): SpoofingVerdict {
  const alertCodes: string[] = [];
  let riskScore = 0;

  const hasDevice = input.deviceLat != null && input.deviceLon != null;
  const hasExif = input.exifLat != null && input.exifLon != null;

  // 1. Discrepância GPS dispositivo vs EXIF
  if (hasDevice && hasExif) {
    const d = distanceMeters(input.deviceLat!, input.deviceLon!, input.exifLat!, input.exifLon!);
    if (d > 5000) { riskScore += 50; alertCodes.push("GPS_EXIF_MAJOR_MISMATCH"); }
    else if (d > 1000) { riskScore += 30; alertCodes.push("GPS_EXIF_MISMATCH"); }
    else if (d > 200) { riskScore += 10; alertCodes.push("GPS_EXIF_MINOR_DIFF"); }
  } else if (hasDevice && !hasExif) {
    riskScore += 5; alertCodes.push("NO_EXIF_GPS");
  }

  // 2. Inconsistência de timestamp (tolerância de fuso horário: 15h)
  if (input.exifTimestamp) {
    const exifDate = new Date(input.exifTimestamp);
    const ref = input.referenceTimestamp ? new Date(input.referenceTimestamp) : new Date();
    if (!isNaN(exifDate.getTime()) && !isNaN(ref.getTime())) {
      const hoursDiff = Math.abs(ref.getTime() - exifDate.getTime()) / 3_600_000;
      const tz = 15;
      if (hoursDiff > 24 + tz) { riskScore += 40; alertCodes.push("TIMESTAMP_MAJOR_MISMATCH"); }
      else if (hoursDiff > tz + 1) { riskScore += 20; alertCodes.push("TIMESTAMP_MISMATCH"); }
    }
  }

  // 3. Movimento impossível
  if (
    input.previousLat != null && input.previousLon != null &&
    hasDevice && input.secondsSinceLastCapture && input.secondsSinceLastCapture > 0
  ) {
    const d = distanceMeters(input.previousLat, input.previousLon, input.deviceLat!, input.deviceLon!);
    const speedKmh = d / 1000 / (input.secondsSinceLastCapture / 3600);
    if (speedKmh > 1000) { riskScore += 60; alertCodes.push("IMPOSSIBLE_MOVEMENT"); }
    else if (speedKmh > 300) { riskScore += 30; alertCodes.push("SUSPICIOUS_MOVEMENT"); }
  }

  // 4. Precisão GPS baixa
  if (input.deviceAccuracy != null && input.deviceAccuracy > 100) {
    riskScore += 15; alertCodes.push("LOW_GPS_ACCURACY");
  }

  riskScore = Math.min(riskScore, 100);

  let riskLevel: SpoofRiskLevel;
  if (riskScore >= 80) riskLevel = "critical";
  else if (riskScore >= 50) riskLevel = "high";
  else if (riskScore >= 30) riskLevel = "medium";
  else if (riskScore >= 10) riskLevel = "low";
  else riskLevel = "none";

  return { isSuspicious: riskScore >= 30, riskLevel, riskScore, alertCodes };
}
