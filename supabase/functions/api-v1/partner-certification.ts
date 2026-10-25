/** Temporary fail-closed boundary until account linking and evidence are validated.
 * A profile phone (especially its national-number suffix) is not identity proof.
 * No DB port is accepted: this endpoint cannot enumerate accounts or certificates.
 */
export function partnerCertificationStatus(
  suppliedKey: string | null,
  expectedKey: string | undefined,
  body: unknown,
): { status: number; data: { certified: false; reason: string } } {
  const result = (status: number, reason: string) => ({ status, data: { certified: false as const, reason } });
  if (!expectedKey || suppliedKey !== expectedKey) return result(401, 'unauthorized');
  if (!body || typeof body !== 'object' || Array.isArray(body)) return result(400, 'invalid_request');
  const input = body as Record<string, unknown>;
  if (input.consent !== true) return result(400, 'consent_required');
  // Full international form only. Do not guess country or compare suffixes.
  if (typeof input.phone !== 'string' || !/^\+[1-9]\d{7,14}$/.test(input.phone)) return result(400, 'invalid_request');
  if (typeof input.code !== 'string' || !input.code.trim() || input.code !== input.code.trim()) return result(400, 'invalid_request');
  return result(503, 'integration_pending');
}
