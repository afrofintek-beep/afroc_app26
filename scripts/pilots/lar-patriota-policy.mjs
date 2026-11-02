/** Pure simulation policy. Inputs MUST be assembled from trusted server records
 * before any future production integration. Never authorizes certificate issuance. */
export const policy = Object.freeze({
  version: 'lar-patriota-v1', name: 'Lar do Patriota', municipality: 'Talatona',
  country: 'AO', maxParticipants: 100, manualReviewCount: 30,
  witnessLimit: 5, maxValidityDays: 90,
});

export function evaluate(request, context, now = Date.now()) {
  const result = (status, reasons) => ({
    policyVersion: policy.version, mode: 'simulation', status, reasons,
    authorizesCertificate: false, authorizesBenefits: false,
  });
  const text = v => typeof v === 'string' && v.trim().length > 0;
  const current = proof => proof && proof.revoked === false &&
    Number.isFinite(Date.parse(proof.issuedAt)) && Date.parse(proof.issuedAt) <= now &&
    Number.isFinite(Date.parse(proof.expiresAt)) && Date.parse(proof.expiresAt) > now;
  if (!Number.isFinite(now) || !request || !context ||
      !text(request.id) || !text(request.subjectId) || !text(request.addressCode) ||
      !text(request.addressRevision) || !text(request.bandaId) ||
      !text(request.boundaryVersion) || request.consent !== true ||
      !Number.isInteger(request.sequence) || request.sequence < 1 ||
      !Array.isArray(request.responses)) return result('invalid', ['invalid_request']);
  if (request.sequence > policy.maxParticipants) return result('blocked', ['pilot_capacity']);
  if (context.country !== 'AO' || context.boundaryApproved !== true ||
      !text(context.bandaId) || !text(context.boundaryVersion))
    return result('blocked', ['territory_not_ready']);
  if (request.bandaId !== context.bandaId || request.boundaryVersion !== context.boundaryVersion ||
      request.insideBoundary !== true) return result('review', ['territory_mismatch']);
  const ids = new Set();
  const confirmed = [];
  const review = new Set();
  for (const r of request.responses) {
    if (!r || !text(r.witnessId) || ids.has(r.witnessId) || r.witnessId === request.subjectId)
      return result('invalid', ['duplicate_or_self_witness']);
    ids.add(r.witnessId);
    if (!['confirm', 'deny', 'unknown'].includes(r.answer)) return result('invalid', ['invalid_answer']);
    if (r.requestId !== request.id || r.addressCode !== request.addressCode ||
        r.addressRevision !== request.addressRevision || r.subjectId !== request.subjectId)
      return result('invalid', ['evidence_binding_mismatch']);
    if (!text(r.declarationVersion) || !text(r.relationship) || !text(r.knownSince) ||
        !current(r.identity) || !current(r.attestation) || r.authenticated !== true)
      return result('invalid', ['unverified_or_expired_evidence']);
    if (r.answer === 'deny') review.add('contradictory_testimony');
    if (r.answer !== 'confirm') continue;
    if (r.knowsPerson !== true || r.knowsResidence !== true)
      return result('invalid', ['residence_not_attested']);
    if (!Number.isInteger(r.confirmationsLast30Days) || r.confirmationsLast30Days < 0)
      return result('invalid', ['missing_witness_history']);
    if (r.confirmationsLast30Days >= policy.witnessLimit) review.add('witness_limit');
    if (r.reciprocalPattern !== false || r.sameHousehold !== false) review.add('independence_review');
    confirmed.push(r);
  }
  if (review.size) return result('review', [...review]);
  if (confirmed.length < 2) return result('waiting', ['two_confirmations_required']);
  if (!confirmed.some(r => current(r.localProof) && r.localProof.bandaId === request.bandaId &&
      r.localProof.independentlyVerified === true)) return result('review', ['independent_local_proof_required']);
  if (request.sequence <= policy.manualReviewCount || context.initialAuditPassed !== true)
    return result('review', ['initial_manual_review']);
  return result('eligible_for_reviewed_issuance', ['policy_checks_passed']);
}
