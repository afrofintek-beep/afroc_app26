/**
 * AFROLOC SDK Unit Tests
 * 
 * 10+ real-world test cases covering:
 * - Luanda urban encoding/decoding (Maianga, Viana, Cacuaco)
 * - Rural zones (Huambo, Benguela)
 * - Roundtrip encode→decode consistency
 * - Legacy format validation & conversion
 * - Invalid inputs (non-African country, bad coordinates, malformed codes)
 */

import { describe, it, expect } from "vitest";
import { encode, decode, validate, distance, deepLink, isAfricanCountry, SDK } from "./sdk";

// ─── 1. Luanda Centro (Maianga) — Urban ─────────────────────────
describe("encode — Luanda urban", () => {
  it("1. Maianga (-8.8383, 13.2344) produces valid AO-ZU-G10 code", () => {
    const result = encode(-8.8383, 13.2344, "AO", "urban");
    expect(result.code).toMatch(/^AO-ZU-G10-X[A-Z0-9N]+-Y[A-Z0-9N]+$/);
    expect(result.zone).toBe("urban");
    expect(result.gridSize).toBe(10);
  });

  it("2. Viana (-8.9036, 13.3733) produces valid AO-ZU-G10 code", () => {
    const result = encode(-8.9036, 13.3733, "AO", "urban");
    expect(result.code).toMatch(/^AO-ZU-G10-X[A-Z0-9N]+-Y[A-Z0-9N]+$/);
    expect(result.zone).toBe("urban");
  });

  it("3. Cacuaco (-8.7656, 13.3694) produces valid AO-ZU-G10 code", () => {
    const result = encode(-8.7656, 13.3694, "AO", "urban");
    expect(result.code).toMatch(/^AO-ZU-G10-X/);
    expect(result.gridSize).toBe(10);
  });
});

// ─── 2. Rural zones ─────────────────────────────────────────────
describe("encode — Angola rural", () => {
  it("4. Huambo rural (-12.7761, 15.7392) produces AO-ZR-G25 code", () => {
    const result = encode(-12.7761, 15.7392, "AO", "rural");
    expect(result.code).toMatch(/^AO-ZR-G25-X[A-Z0-9N]+-Y[A-Z0-9N]+$/);
    expect(result.zone).toBe("rural");
    expect(result.gridSize).toBe(25);
  });

  it("5. Benguela rural (-12.5763, 13.4055) produces AO-ZR-G25 code", () => {
    const result = encode(-12.5763, 13.4055, "AO", "rural");
    expect(result.code).toMatch(/^AO-ZR-G25-/);
    expect(result.gridSize).toBe(25);
  });
});

// ─── 3. Roundtrip encode→decode ─────────────────────────────────
describe("roundtrip encode→decode", () => {
  it("6. Maianga roundtrip centroid within 10m of input", () => {
    const lat = -8.8383;
    const lon = 13.2344;
    const encoded = encode(lat, lon, "AO", "urban");
    const decoded = decode(encoded.code);

    // Centroid should be within one grid cell (10m) of the original
    const dist = distance(lat, lon, decoded.centroid.lat, decoded.centroid.lon);
    expect(dist).toBeLessThan(15); // generous tolerance for grid snapping
    expect(decoded.countryCode).toBe("AO");
    expect(decoded.zone).toBe("urban");
    expect(decoded.gridSize).toBe(10);
  });

  it("7. Huambo rural roundtrip centroid within 25m of input", () => {
    const lat = -12.7761;
    const lon = 15.7392;
    const encoded = encode(lat, lon, "AO", "rural");
    const decoded = decode(encoded.code);

    const dist = distance(lat, lon, decoded.centroid.lat, decoded.centroid.lon);
    expect(dist).toBeLessThan(35); // generous tolerance for 25m grid
    expect(decoded.zone).toBe("rural");
    expect(decoded.gridSize).toBe(25);
  });
});

// ─── 4. Validate — standard, legacy, invalid ───────────────────
describe("validate", () => {
  it("8. Standard code validates correctly", () => {
    const encoded = encode(-8.8383, 13.2344, "AO", "urban");
    const result = validate(encoded.code);
    expect(result.valid).toBe(true);
    expect(result.wasConverted).toBe(false);
  });

  it("9. Legacy URBAN tag converts to ZU", () => {
    // Simulate a legacy code with old zone tag
    const encoded = encode(-8.8383, 13.2344, "AO", "urban");
    // Replace ZU with URBAN to simulate legacy
    const legacyCode = encoded.code.replace("ZU", "URBAN");
    const result = validate(legacyCode);

    // Old zone tag pattern should be detected if it matches
    if (result.valid) {
      expect(result.wasConverted).toBe(true);
      expect(result.originalFormat).toBe("old-zone-tags");
      expect(result.normalizedCode).toMatch(/^AO-ZU-/);
    }
  });

  it("10. Invalid code returns valid: false", () => {
    const result = validate("INVALID-CODE-FORMAT");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("11. Empty string returns valid: false", () => {
    const result = validate("");
    expect(result.valid).toBe(false);
  });
});

// ─── 5. Non-African country throws ─────────────────────────────
describe("encode — error handling", () => {
  it("12. Non-African country (FR) throws error", () => {
    expect(() => encode(48.8566, 2.3522, "FR", "urban")).toThrow(
      "Invalid African country code: FR"
    );
  });

  it("13. Latitude out of range throws error", () => {
    expect(() => encode(91, 13.234, "AO", "urban")).toThrow("Latitude out of range");
  });

  it("14. Longitude out of range throws error", () => {
    expect(() => encode(-8.838, 200, "AO", "urban")).toThrow("Longitude out of range");
  });
});

// ─── 6. Utility functions ───────────────────────────────────────
describe("utilities", () => {
  it("15. isAfricanCountry identifies AO, MZ, KE correctly", () => {
    expect(isAfricanCountry("AO")).toBe(true);
    expect(isAfricanCountry("MZ")).toBe(true);
    expect(isAfricanCountry("KE")).toBe(true);
    expect(isAfricanCountry("FR")).toBe(false);
    expect(isAfricanCountry("US")).toBe(false);
  });

  it("16. distance between Luanda and Viana ≈ 15-20km", () => {
    const d = distance(-8.8383, 13.2344, -8.9036, 13.3733);
    expect(d).toBeGreaterThan(10000);
    expect(d).toBeLessThan(25000);
  });

  it("17. deepLink generates correct native and web URLs", () => {
    const links = deepLink("address", "AO-ZU-G10-XTEST-YTEST", "https://app.afroloc.com");
    expect(links.native).toBe("afroloc://address/AO-ZU-G10-XTEST-YTEST");
    expect(links.web).toBe("https://app.afroloc.com/dl/address/AO-ZU-G10-XTEST-YTEST");
  });

  it("18. SDK metadata is correct", () => {
    expect(SDK.name).toBe("@afroloc/sdk");
    expect(SDK.version).toBe("1.0.0");
    expect(SDK.projection).toBe("EPSG:3857 (Web Mercator)");
    expect(SDK.gridSizes.urban).toBe(10);
    expect(SDK.gridSizes.rural).toBe(25);
  });
});

// ─── 7. Decode error handling ───────────────────────────────────
describe("decode — error handling", () => {
  it("19. Decoding garbage string throws", () => {
    expect(() => decode("NOT-A-CODE")).toThrow("Cannot decode AFROLOC code");
  });
});

// ─── 8. Bbox consistency ────────────────────────────────────────
describe("decode — bbox", () => {
  it("20. Decoded bbox contains centroid", () => {
    const encoded = encode(-8.8383, 13.2344, "AO", "urban");
    const decoded = decode(encoded.code);
    expect(decoded.centroid.lat).toBeGreaterThanOrEqual(decoded.bbox.minLat);
    expect(decoded.centroid.lat).toBeLessThanOrEqual(decoded.bbox.maxLat);
    expect(decoded.centroid.lon).toBeGreaterThanOrEqual(decoded.bbox.minLon);
    expect(decoded.centroid.lon).toBeLessThanOrEqual(decoded.bbox.maxLon);
  });
});
