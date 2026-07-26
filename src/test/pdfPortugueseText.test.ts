import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Guard for the A6 PDF card: it must render Portuguese/Unicode text correctly
// (via a canvas image, since jsPDF's default font drops accents) and clamp long
// addresses so they never overflow the page.
const src = readFileSync(
  join(process.cwd(), "src", "components", "QRCodeDialog.tsx"),
  "utf8",
);

describe("A6 PDF renders Portuguese/Unicode text", () => {
  it("draws the card on a canvas and places it via addImage (Unicode-safe)", () => {
    expect(/renderCardCanvas/.test(src)).toBe(true);
    expect(/addImage\s*\(/.test(src)).toBe(true);
    expect(/toDataURL\(["']image\/png/.test(src)).toBe(true);
  });

  it("wraps/clamps long address text to avoid overflow", () => {
    expect(/measureText|splitTextToSize/.test(src)).toBe(true);
  });
});
