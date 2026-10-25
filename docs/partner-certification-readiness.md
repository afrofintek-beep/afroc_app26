# Partner certification readiness — 2026-10-25

## Confirmed official service

User identified `afroloc.ao` as the live application. Vercel's domain inventory maps `afroloc.ao` (308 redirect) and `www.afroloc.ao` to project `prj_uAk8Vpx3CmFVAZNiHWVRxlE9KtZ9`. The public application bundle `/assets/index-eRDAyk4r.js` embeds `https://ljcxqwjvjgobhisqkujr.supabase.co`.

This repository's Supabase config matches that project. Its `supabase/functions/api-v1/index.ts` (blob `dee14bc5098feb5da84b659f0e24e9de15bf1510`) exactly matches the main entrypoint of hosted `api-v1` version 36. This identifies the API implementation; the frontend deployment commit remains unconfirmed because Vercel deployment inspection returns access errors.

The endpoint DOES exist at `https://ljcxqwjvjgobhisqkujr.supabase.co/functions/v1/api-v1/partners/certification-status`. Earlier examination of `app-builder-buddy-192` was of a different source and must not be used to claim the official endpoint is absent.

## Actual legacy contract and flaw

- Shared secret `YAMILOOK_PARTNER_KEY`, header `x-partner-key`.
- Request `{phone}`; lookup strips non-digits and matches only the last nine digits against editable `profiles.phone`.
- Collects matching profile users, selects the first `afroloc_records` row with `status=certified`, and returns `{success:true,data:{certified:true,code,status}}`.
- Does not bind the request to the declared code; no subject authorization or evidence expiry/revocation is returned. Different international numbers may share that suffix.
- The repo sets `verify_jwt=true`, but the hosted v36 reports `verify_jwt=false`. The live route therefore relies on its internal partner key. This deployment/configuration drift must be reconciled intentionally; this patch preserves the hosted gateway setting.

## Change

Suspend only the partner certification route. Validate partner key, explicit consent, complete E.164 phone and exact nonempty code; then return `503 integration_pending`. No DB lookup, phone enumeration, address disclosure or certificate writes are possible through this route. No production flag silently re-enables suffix lookup. Other API routes and the gateway JWT setting remain unchanged.

The client side in Yamilook PR #28 is already suspended independently. No shared identity, new certificate, phone migration or account merge is enabled by either patch.

## Phone verification findings

Hosted `phone-login` v35 uses a custom OTP store and picks the most recent matching profile when duplicates exist. It creates synthetic-email users for new phones and resets the existing user's password to produce a session. It must not be reused for associating a phone to an existing Yamilook UUID. Its development OTP-reuse path also relies partly on the caller-controlled Origin header; remediate that separately before relying on this authentication flow for cross-service identity.

Hosted `verify-change-phone-otp` v36 checks the authenticated user, but retrieves the OTP by phone; the observed handler does not bind the challenge lookup to the requesting UUID and purpose, and consumption/profile update are separate operations. It changes `profiles.phone`, not a native Auth-confirmed phone. The shared SMS implementation uses Infobip; configuration and delivery were not exercised and no SMS was sent.

## Remaining activation work

1. Choose and implement an explicit account-link authorization protocol using independent app identities. Prefer a short-lived, one-use grant issued by AFROLOC after authenticated consent, bound to destination, local account, AFROLOC subject and code; never infer linkage from a phone suffix or silently merge accounts.
2. Fix and validate OTP identity/purpose binding, duplicate handling, atomic consumption, limits and recovery. Retain existing Yamilook UUIDs, email access, messages and contacts.
3. Establish authoritative certificate issuance and protected fields. The live schema includes `afroloc_validations.expires_at`, record verification deadlines and resident validity/revocation fields. Their semantics and all write paths must be validated before defining the partner response; a record status alone is insufficient.
4. Issue evidence with issuer, audience, subject, exact code, evidence ID, timestamps, revocation state and request binding. Store/consume it with expiry and revocation enforcement, not a permanent boolean.
5. Validate two authorized test accounts and negative cases across the real services. No positive certification was attempted here.

Six Node tests pass for authorization, strict consent, malformed input, full international numbers, cross-country suffix collisions and refusal of client-supplied certification claims. These are boundary tests, not a completed cross-service certification flow.
