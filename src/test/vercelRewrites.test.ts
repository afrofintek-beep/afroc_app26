import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Behavioral test: the vercel.json SPA rewrite must send extension-less deep
// routes to index.html, but NEVER rewrite real static files (so missing assets
// return a real 404) nor api/ paths.
const vercel = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8"));
const rule = vercel.rewrites[0];
const re = new RegExp("^" + rule.source + "$");
const rewrittenToIndex = (p: string) => re.test(p);

describe("vercel.json SPA rewrite", () => {
  it("targets index.html", () => {
    expect(rule.destination).toBe("/index.html");
  });

  it("rewrites deep SPA routes to index.html", () => {
    for (const p of ["/create-identity", "/my-addresses", "/u/someuser", "/identities/123", "/"]) {
      expect(rewrittenToIndex(p)).toBe(true);
    }
  });

  it("does NOT rewrite real static files (assets, sw, manifest, icons)", () => {
    for (const p of [
      "/assets/index-abc123.js",
      "/assets/index-abc123.css",
      "/sw.js",
      "/sw-push.js",
      "/manifest.webmanifest",
      "/favicon.ico",
      "/favicon.png",
      "/pwa-192x192.png",
      "/pwa-512x512.png",
      "/apple-touch-icon.png",
    ]) {
      expect(rewrittenToIndex(p)).toBe(false);
    }
  });

  it("does NOT rewrite api/ paths", () => {
    expect(rewrittenToIndex("/api/anything")).toBe(false);
  });
});
