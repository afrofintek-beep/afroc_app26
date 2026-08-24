/**
 * URL pública canónica usada nos QR Codes permanentes AFROLOC.
 *
 * VITE_YAMIOO_PUBLIC_URL permite preview/staging explícito. Sem configuração,
 * o artefacto partilhável aponta sempre para produção e nunca para localhost.
 */
export function buildYamiooAfrolocUrl(code: string): string {
  const configured = (import.meta.env.VITE_YAMIOO_PUBLIC_URL as string | undefined)?.trim();
  const base = (configured || "https://yamioo.com").replace(/\/+$/, "");
  const normalizedCode = code.trim().toUpperCase();
  return `${base}/a/${encodeURIComponent(normalizedCode)}`;
}
