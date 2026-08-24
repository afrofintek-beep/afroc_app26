import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(
  join(process.cwd(), "src", "components", "QRCodeDialog.tsx"),
  "utf8",
);

describe("QR payload excludes location and personal data", () => {
  it("encodes only the canonical YAMIOO URL built from record.code", () => {
    expect(src).toContain("QRCode.toDataURL(buildYamiooAfrolocUrl(record.code)");
    expect(src).not.toContain("QRCode.toDataURL(JSON.stringify(");
  });

  it("does not construct a structured address payload for the QR", () => {
    expect(src).not.toMatch(/const\s+qrData\s*=\s*\{/);
  });
});
