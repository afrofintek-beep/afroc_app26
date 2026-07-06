// Helpers partilhados WebAuthn (Deno / edge functions).

/** Uint8Array -> base64url (sem padding). */
export function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url -> Uint8Array. */
export function fromBase64Url(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Resolve a origem/rpID válidos a partir do header Origin do pedido,
 * validado contra a allowlist do secret WEBAUTHN_ALLOWED_ORIGINS
 * (lista separada por vírgulas, ex.:
 *   "https://afroc-app26-rose.vercel.app,https://afroloc.ao,http://localhost:8080").
 * Devolve null se a origem não for permitida (rejeitar o pedido).
 */
export function resolveOrigin(
  req: Request,
): { origin: string; rpID: string } | null {
  const allowed = (Deno.env.get("WEBAUTHN_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return null;

  const reqOrigin = req.headers.get("Origin") ?? "";
  const origin = allowed.find((o) => o === reqOrigin);
  if (!origin) return null;

  try {
    return { origin, rpID: new URL(origin).hostname };
  } catch {
    return null;
  }
}
