# Security and privacy baseline

Status: Confirmed baseline  
Last updated: 2026-07-30

This document defines product and architecture requirements, not legal advice.
External requirements must be validated by qualified Ghanaian professionals
before launch.

## Data governance

Doraf must:

- register with Ghana's Data Protection Commission before production
  processing,
- assign a responsible data-protection lead,
- maintain an inventory of processing activities and providers,
- document purpose and lawful basis for each personal-data category,
- publish plain-language privacy notices for agents and guest buyers,
- establish data-subject request procedures,
- maintain processor contracts and cross-border data documentation,
- train internal operators, and
- periodically review compliance and security controls.

The Ghana Data Protection Commission publishes registration requirements and
the principles of accountability, lawfulness, purpose specification, data
quality, openness, security, and data-subject participation.

Official references:

- https://dataprotection.org.gh/registration/
- https://dataprotection.org.gh/
- https://dataprotection.org.gh/wp-content/uploads/2025/05/Data-Protection-Act-2012-Act-843.pdf

## Personal-data map

Expected categories include:

- agent name and phone number,
- internal-operator identity and authentication data,
- buyer delivery phone number and optional email,
- Mobile Money payer number and network,
- synthetic Paystack email derived from payer number,
- provider customer, payment, refund, recipient, and transfer identifiers,
- IP address, device, session, and abuse-prevention signals where justified,
- Support contact and dispute evidence,
- audit records, and
- notification and recovery history.

Voucher serial numbers and PINs are high-value secrets even when they are not
personal data in isolation.

## Data minimization

Ordinary checkout, payment, delivery, and recovery do not collect:

- student Index Number,
- Examination Year,
- the student's selected Exam Type,
- school information,
- date of birth, or
- age.

Dispute handling requests the minimum additional information necessary.
Evidence instructions encourage redaction of unrelated student data.

Because a buyer or intended student may be a minor, qualified advice must
confirm appropriate notices, consent, evidence handling, and support practices.

## Privacy notices and rights

Separate notices explain:

- what Doraf collects,
- why it is needed,
- required versus optional fields,
- recipients and providers,
- international or cross-border processing,
- retention,
- security and incident handling,
- data-subject rights, and
- how to contact Doraf.

Doraf supports authenticated requests for access, correction, objection, and
deletion where applicable. A request does not erase immutable financial,
security, fraud, dispute, or audit records when Doraf must retain them. Instead,
the response explains the applicable restriction and removes data that is no
longer needed where permitted.

## Retention

Create a retention schedule for:

- unverified OTP challenges,
- agent account and recovery records,
- abandoned and paid orders,
- payment and provider payloads,
- sold voucher secrets,
- delivery and recovery history,
- ledger and withdrawal records,
- audit history,
- application and security logs,
- administration exports, and
- complaint evidence.

Each category specifies purpose, trigger, duration, archive behavior, deletion
method, legal hold, and responsible owner.

Exact periods require legal, accounting, provider-contract, and operational
review.

## Processor and provider management

Maintain a register and written terms for:

- Paystack,
- SMS provider,
- email provider,
- USSD provider,
- cloud hosting and storage,
- observability and error monitoring,
- customer-support tooling, and
- any analytics service.

For each provider document:

- controller and processor roles,
- processed data and purpose,
- storage locations and transfers,
- subprocessors,
- security controls,
- retention and deletion,
- breach notification,
- availability and recovery commitments, and
- exit and data-return procedures.

## Authentication

### Agents

Agents use phone number and SMS OTP under the confirmed product model. OTPs are
short-lived, single-use, attempt-limited, rate-limited, and never stored in
plaintext.

Withdrawal requires a fresh OTP.

### Internal operators

Administrator and Support accounts use stronger authentication than SMS OTP:

- phishing-resistant passkeys are preferred,
- authenticator-based MFA may be an approved fallback,
- recovery is narrow and audited,
- sensitive actions use step-up confirmation, and
- sessions have appropriate expiry and revocation.

No internal account is shared.

## Authorization

- Enforce tenant scoping server-side.
- Deny by default.
- Keep Administrator and Support capabilities distinct.
- Do not rely on hidden UI as authorization.
- Do not permit agent impersonation.
- Mask voucher and personal data by default.
- Audit sensitive reads, exports, and mutations.
- Periodically review internal access.

## Voucher-secret protection

- Encrypt serial-number/PIN pairs using keys separated from the database.
- Use narrow, audited decryption paths.
- Use non-reversible fingerprints for duplicate detection.
- Exclude plaintext from logs, traces, analytics, URLs, and email subjects.
- Do not expose raw inventory through exports.
- Rotate keys and test restoration.
- Monitor unusual decrypt volume and Administrator reveal.
- Prepare a voucher-compromise response with inventory quarantine capability.

## Payment and transfer security

- Keep provider secret keys server-side.
- Verify Paystack webhook authenticity.
- Match reference, currency, and amount before accepting payment.
- Use unique references and idempotent processing.
- Separate test and live credentials and data.
- Prevent development, test, and preview environments from initiating live
  charges, refunds, or transfers.
- Restrict production transfer credentials and retain Paystack merchant OTP for
  the MVP.
- Alert on unusual refunds, recipient changes, transfers, and API failures.

## Application and infrastructure baseline

- Encrypt network traffic.
- Encrypt sensitive backups and test restoration.
- Do not copy production secrets or personal data into development.
- Manage secrets outside source control.
- Apply dependency and vulnerability management.
- Protect administrative endpoints and file uploads.
- Malware-check complaint evidence.
- Rate-limit authentication, checkout, recovery, and provider-facing abuse
  paths.
- Maintain security logs without voucher secrets.
- Monitor invariants, availability, and suspicious activity.

## Incident response

Maintain a tested process covering:

1. detection and triage,
2. containment,
3. evidence preservation,
4. credential and key rotation,
5. system integrity restoration,
6. impact and affected-person analysis,
7. internal escalation,
8. provider and regulator coordination,
9. required notification, and
10. lessons learned and control improvement.

Section 31 of Ghana's Data Protection Act addresses notification of security
compromises to the Commission and affected data subjects where applicable.

Official incident resources:

- https://dataprotection.org.gh/wp-content/uploads/2025/07/INCIDENT-BREACH-REPORT-FORM-DPC-SAMPLE.pdf
- https://dataprotection.org.gh/help-faqs/
