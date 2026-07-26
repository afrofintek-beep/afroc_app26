import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Privacy guard: the QR payload must never carry GPS coordinates.
const src = readFileSync(
  join(process.cwd(), "src", "components", "QRCodeDialog.tsx"),
  "utf8",
);

// Isolate the qrData object literal (defined just before QR generation).
function qrDataBlock(): string {
  const start = src.indexOf("qrData");
  expect(start).toBeGreaterThan(-1);
  const genIdx = src.indexOf("QRCode", start);
  return src.slice(start, genIdx > start ? genIdx : start + 1000);
}

describe("QR payload excludes GPS coordinates", () => {
  it("does not encode lat/lon/lng/latitude/longitude/geo_* keys", () => {
    const block = qrDataBlock();
    expect(/\b(lat|lon|lng|latitude|longitude|geo_lat|geo_lon)\b\s*:/.test(block)).toBe(false);
  });
});
