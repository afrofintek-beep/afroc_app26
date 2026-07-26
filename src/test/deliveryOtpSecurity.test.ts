import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regression guards on the delivery-OTP edge functions (Deno) — these enforce the
// production security invariants at the source level, since the functions run on
// Deno and cannot be imported into the jsdom test runtime.
const fnsDir = join(process.cwd(), "supabase", "functions");
const register = readFileSync(join(fnsDir, "delivery-register", "index.ts"), "utf8");
const confirm = readFileSync(join(fnsDir, "delivery-confirm", "index.ts"), "utf8");

describe("delivery-register: OTP is never returned to the client", () => {
  it("does not include an `otp_dev` (or equivalent debug OTP) in the response", () => {
    expect(register.includes("otp_dev")).toBe(false);
  });

  it("does not expose the OTP based on ENVIRONMENT (no dev-leak branch)", () => {
    expect(/ENVIRONMENT[^\n]*otp/i.test(register)).toBe(false);
  });

  it("generates the OTP with a CSPRNG (crypto.getRandomValues)", () => {
    expect(register.includes("crypto.getRandomValues")).toBe(true);
    // No actual Math.random() CALL in code (a comment mentioning it is fine).
    const codeOnly = register
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
      .join("\n");
    expect(/Math\.random\s*\(/.test(codeOnly)).toBe(false);
  });

  it("stores the OTP hashed at rest (SHA-256), never plaintext", () => {
    expect(/sha-?256/i.test(register)).toBe(true);
  });
});

describe("delivery-confirm: expiry, attempt limit, single-use", () => {
  it("uses the shared OTP_MAX_ATTEMPTS, not a hardcoded 5", () => {
    expect(confirm.includes("OTP_MAX_ATTEMPTS")).toBe(true);
    expect(/MAX_OTP_ATTEMPTS\s*=\s*5/.test(confirm)).toBe(false);
  });

  it("enforces OTP expiry", () => {
    expect(confirm.includes("otp_expires_at")).toBe(true);
  });

  it("hashes the submitted OTP before comparing (no plaintext compare)", () => {
    expect(/sha-?256/i.test(confirm)).toBe(true);
  });

  it("clears the OTP on success (single-use / anti-replay)", () => {
    expect(/otp_code:\s*null/.test(confirm)).toBe(true);
  });
});
