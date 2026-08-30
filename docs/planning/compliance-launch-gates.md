# Compliance and external launch gates

Status: Required before production  
Last updated: 2026-07-30

This is a tracking document, not a legal opinion. A gate is complete only when
the responsible professional or provider supplies appropriate evidence.

## Data protection

- [ ] Register Dashchecker with Ghana's Data Protection Commission.
- [ ] Assign data-protection responsibility.
- [ ] Complete the DPC self-assessment or equivalent readiness review.
- [ ] Approve agent and guest-buyer privacy notices.
- [ ] Document purpose and lawful basis for personal-data categories.
- [ ] Approve data-subject request procedures.
- [ ] Approve the retention and deletion schedule.
- [ ] Approve incident and breach-notification procedures.
- [ ] Review minor-related buyer and evidence handling.

Official sources:

- https://dataprotection.org.gh/registration/
- https://dataprotection.org.gh/self-assessment-compliance-tool/
- https://dataprotection.org.gh/documents/

## Payments and financial regulation

- [ ] Obtain qualified Ghanaian advice on Dashchecker's earnings-ledger, agent,
  payment-collection, and payout model.
- [ ] Confirm whether Dashchecker needs authorization, registration, contractual
  controls, or model changes under the Bank of Ghana framework.
- [ ] Preserve the restriction that agent balances cannot be topped up, spent,
  or transferred.
- [ ] Complete Paystack Ghana production onboarding.
- [ ] Confirm Paystack payment, refund, transfer, settlement, fee, and data
  terms.
- [ ] Confirm Mobile Money and transfer limits before launch.
- [ ] Test live-mode operational controls with authorized low-value scenarios.

The Bank of Ghana currently lists Paystack Ghana LTD as PSP Enhanced. This does
not itself determine Dashchecker's regulatory classification.

Official sources:

- https://www.bog.gov.gh/fintech-innovation/approved-institutions/
- https://www.bog.gov.gh/fintech-innovation/licence-categories/
- https://www.bog.gov.gh/notice/licensing-and-authorisation-of-payment-service-providers/

## WAEC and inventory

- [ ] Execute written agreements with authorized WAEC vendors.
- [ ] Confirm authority to resell each checker product.
- [ ] Confirm authority to store voucher secrets electronically.
- [ ] Confirm authority to deliver vouchers by SMS and email.
- [ ] Confirm use of WAEC names, product descriptions, and portal links.
- [ ] Define vendor invalid-voucher and reimbursement procedures.

## Tax and accounting

- [ ] Obtain qualified advice on revenue recognition.
- [ ] Confirm VAT and other applicable tax treatment.
- [ ] Confirm agent earning, withholding, and reporting obligations.
- [ ] Define receipt or invoice requirements.
- [ ] Approve treatment of refunds, reversals, negative agent balances, and
  unclaimed funds.
- [ ] Approve financial-record retention.

## Providers and communications

- [ ] Contract SMS, email, and USSD providers.
- [ ] Confirm sender IDs, shared short code, agent-code parameters, session
  limits, delivery receipts, and pricing.
- [ ] Execute required data-processing and security terms.
- [ ] Document data locations, transfers, and subprocessors.
- [ ] Define outage, escalation, reconciliation, and exit procedures.

## Security readiness

- [ ] Complete threat modeling.
- [ ] Implement and test role and tenant authorization.
- [ ] Complete voucher encryption and key-management review.
- [ ] Verify logs and analytics contain no voucher secrets.
- [ ] Complete webhook, idempotency, and concurrency testing.
- [ ] Verify non-production environments cannot move production money.
- [ ] Test backup restoration and disaster recovery.
- [ ] Complete vulnerability assessment and penetration testing.
- [ ] Run incident-response and voucher-compromise exercises.
- [ ] Approve production access and monitoring.
