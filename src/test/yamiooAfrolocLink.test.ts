import { describe, expect, it } from "vitest";
import { buildYamiooAfrolocUrl } from "@/lib/yamiooAfrolocLink";

describe("AFROLOC permanent QR link", () => {
  it("opens the canonical YAMIOO resolver route", () => {
    expect(buildYamiooAfrolocUrl(" ao-lda-belas-gen-g10-35a8-n250u ")).toBe(
      "https://yamioo.com/a/AO-LDA-BELAS-GEN-G10-35A8-N250U",
    );
  });

  it("encodes the code as a path segment", () => {
    expect(buildYamiooAfrolocUrl("AO TEST/1")).toBe(
      "https://yamioo.com/a/AO%20TEST%2F1",
    );
  });
});
