# Agent onboarding flow

Status: Confirmed product flow  
Last updated: 2026-07-30

## Registration

1. Agent enters their phone number.
2. Dashchecker sends an SMS OTP.
3. Agent submits the OTP within its expiry and attempt limits.
4. Dashchecker verifies that the phone number has no existing agent account.
5. Agent enters their name.
6. Dashchecker creates the individual one-user tenant.
7. Dashchecker assigns one permanent web sales link.
8. Dashchecker assigns one permanent USSD referral code.
9. Dashchecker creates the wallet and default product-pricing records.

Identity verification, email, business details, and staff invitations are not
part of MVP registration.

The presentation and acceptance requirements for platform terms and privacy
notices remain part of the compliance topic.

## Initial setup

1. Let the agent set a store name and public link name.
2. Show the checker products, effective base and maximum retail prices.
3. Let the agent select a valid retail price for each product and show profit
   per voucher.
4. Show binary product availability for review.
5. Present copy and share actions for the finished web link.
6. Take the agent to the dashboard.

Whether Dashchecker supplies a default retail price before the agent explicitly saves
one remains open.

## Returning sign-in

1. Agent enters the registered phone number.
2. Dashchecker sends an SMS OTP.
3. Agent submits the OTP.
4. Dashchecker opens the active portal or suspended read-only portal according to
   account status.

## First-run portal presentation

After an active agent signs in, the portal opens a short onboarding modal for
the initial setup. It presents four checklist steps in order: set the store
name and public link, set valid retail prices, review binary product
availability, and finally copy or open the finished web sales link. The agent
can postpone the modal and resume it from the portal, but it returns on a later
login until the server records completion.

The server records onboarding start, each meaningful step, dismissal, and final
completion timestamps. Completion is accepted only after the API verifies the
store identity, all configured products have valid retail prices, and the
availability-review and storefront-share actions were recorded. The tracking
record contains no buyer, voucher, phone, or inventory-secret data.
