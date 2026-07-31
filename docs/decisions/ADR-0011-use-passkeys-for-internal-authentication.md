# ADR-0011: Use passkeys for internal authentication

Status: Accepted  
Date: 2026-07-31

## Context

Doraf's Administrator and Support operators require authentication stronger
than agent SMS OTP. These accounts can reach inventory, configuration,
investigation, and money-operation workflows, so passwords or SMS-only login
would create avoidable phishing and account-recovery risk.

The API also needs a safe way to enroll the first Administrator without opening
public internal-account registration or keeping a shared bootstrap password.

## Decision

Use discoverable WebAuthn passkeys as the MVP internal login credential. Require
authenticator user verification during both registration and authentication.
Use no passwords and no SMS fallback for internal login.

Use `@simplewebauthn/server` behind a Doraf-owned adapter. Store only credential
IDs, public keys, counters, transports, device/backup metadata, names, and
operational timestamps. Private key material remains with the operator's
authenticator or passkey provider.

Passkey enrollment requires a short-lived, single-use, high-entropy token whose
database representation is a keyed HMAC fingerprint. An authenticated
Administrator creates later operator invitations. A local bootstrap command can
create the first Administrator invitation only while no internal user exists.

WebAuthn ceremonies expire after five minutes, allow at most five verification
attempts, and are consumed atomically. A verified passkey assertion issues an
opaque eight-hour session; only its keyed fingerprint is stored. Logout,
expiry, account suspension, and server-side revocation invalidate access.

The same fresh passkey assertion will be used for future Administrator step-up
actions. Implementing those individual action endpoints remains part of their
respective domain slices.

## Consequences

- Internal login is phishing-resistant and has no reusable server-side secret.
- The administration web origin and relying-party ID become security-critical
  deployment configuration.
- Operators need passkey-capable browsers and authenticators.
- Recovery must use a narrow Administrator-controlled passkey re-enrollment
  process; a broader authenticator-MFA fallback is not included yet.
- Authentication endpoints have application rate limits. A shared or edge rate
  limit is still required before multi-instance production because the current
  limiter is process-local.
- Enrollment tokens and bearer session tokens must never enter logs or
  analytics.

## Alternatives considered

### Password plus TOTP

Rejected as the primary method because it retains a phishable password and adds
password-reset, storage, and breach-response obligations.

### SMS OTP

Rejected for internal operators because it does not satisfy the confirmed
stronger-authentication requirement.

### Managed authentication service

Deferred. Supabase is deliberately database-only, and adding another identity
provider would add cost and operational dependency before the small internal
operator population justifies it.
