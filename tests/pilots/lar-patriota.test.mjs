import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../../scripts/pilots/lar-patriota-policy.mjs';

const now = Date.parse('2026-11-02T12:00:00Z');
const proof = () => ({issuedAt:'2026-11-01T12:00:00Z',expiresAt:'2026-12-01T12:00:00Z',revoked:false});
function fixture() {
  const context = {country:'AO',boundaryApproved:true,bandaId:'test-banda',boundaryVersion:'test-v1',initialAuditPassed:true};
  const request = {id:'test-request',subjectId:'test-person',addressCode:'TEST-ADDRESS',addressRevision:'v1',bandaId:'test-banda',boundaryVersion:'test-v1',consent:true,insideBoundary:true,sequence:31,responses:[]};
  request.responses = ['test-w1','test-w2'].map(witnessId => ({witnessId,requestId:request.id,subjectId:request.subjectId,addressCode:request.addressCode,addressRevision:'v1',answer:'confirm',declarationVersion:'v1',relationship:'neighbor',knownSince:'2025',identity:proof(),attestation:proof(),authenticated:true,knowsPerson:true,knowsResidence:true,confirmationsLast30Days:0,reciprocalPattern:false,sameHousehold:false,localProof:{...proof(),bandaId:'test-banda',independentlyVerified:true}}));
  return {request,context};
}
test('valid evidence only gives a simulation recommendation', () => {
  const {request,context}=fixture(); const r=evaluate(request,context,now);
  assert.equal(r.status,'eligible_for_reviewed_issuance');
  assert.equal(r.authorizesCertificate,false); assert.equal(r.authorizesBenefits,false);
});
for (const [name, mutate, status] of [
  ['missing perimeter', (r,c)=>c.boundaryApproved=false, 'blocked'],
  ['wrong Banda', r=>r.bandaId='other', 'review'],
  ['boundary revision', r=>r.boundaryVersion='v2', 'review'],
  ['outside perimeter', r=>r.insideBoundary=false, 'review'],
  ['missing consent', r=>r.consent=false, 'invalid'],
  ['capacity', r=>r.sequence=101, 'blocked'],
  ['initial cohort', r=>r.sequence=30, 'review'],
  ['audit pending', (r,c)=>c.initialAuditPassed=false, 'review'],
  ['one witness', r=>r.responses.pop(), 'waiting'],
  ['unknown', r=>r.responses[1].answer='unknown', 'waiting'],
  ['denial', r=>r.responses[1].answer='deny', 'review'],
  ['self', r=>r.responses[0].witnessId=r.subjectId, 'invalid'],
  ['duplicate', r=>r.responses[1].witnessId=r.responses[0].witnessId, 'invalid'],
  ['address changed', r=>r.addressRevision='v2', 'invalid'],
  ['other request', r=>r.responses[0].requestId='other', 'invalid'],
  ['identity expired', r=>r.responses[0].identity.expiresAt='2026-11-02T12:00:00Z', 'invalid'],
  ['identity revoked', r=>r.responses[0].identity.revoked=true, 'invalid'],
  ['future evidence', r=>r.responses[0].attestation.issuedAt='2027-01-01', 'invalid'],
  ['invalid date', r=>r.responses[0].identity.expiresAt='invalid', 'invalid'],
  ['phone only', r=>r.responses[0].identity=null, 'invalid'],
  ['person but not residence', r=>r.responses[0].knowsResidence=false, 'invalid'],
  ['witness limit', r=>r.responses[0].confirmationsLast30Days=5, 'review'],
  ['missing history', r=>delete r.responses[0].confirmationsLast30Days, 'invalid'],
  ['reciprocal', r=>r.responses[0].reciprocalPattern=true, 'review'],
  ['household', r=>r.responses[0].sameHousehold=true, 'review'],
  ['no independent local proof', r=>r.responses.forEach(w=>w.localProof.independentlyVerified=false), 'review'],
  ['revoked local proof', r=>r.responses.forEach(w=>w.localProof.revoked=true), 'review'],
]) test(name, () => {const {request,context}=fixture();mutate(request,context);assert.equal(evaluate(request,context,now).status,status);});
test('malformed inputs fail closed',()=>{for(const r of [null,{},[],42]) assert.equal(evaluate(r,{},now).status,'invalid');});
