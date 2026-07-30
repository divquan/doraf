# Agent onboarding flow

Status: Confirmed product flow  
Last updated: 2026-07-30

## Registration

1. Agent enters their phone number.
2. Doraf sends an SMS OTP.
3. Agent submits the OTP within its expiry and attempt limits.
4. Doraf verifies that the phone number has no existing agent account.
5. Agent enters their name.
6. Doraf creates the individual one-user tenant.
7. Doraf assigns one permanent web sales link.
8. Doraf assigns one permanent USSD referral code.
9. Doraf creates the wallet and default product-pricing records.

Identity verification, email, business details, and staff invitations are not
part of MVP registration.

The presentation and acceptance requirements for platform terms and privacy
notices remain part of the compliance topic.

## Initial setup

1. Show the three checker products.
2. Show effective base and maximum retail prices.
3. Let the agent select a valid retail price for each product.
4. Show profit per voucher.
5. Show binary product availability.
6. Present copy and share actions for the web link and USSD code.
7. Take the agent to the dashboard.

Whether Doraf supplies a default retail price before the agent explicitly saves
one remains open.

## Returning sign-in

1. Agent enters the registered phone number.
2. Doraf sends an SMS OTP.
3. Agent submits the OTP.
4. Doraf opens the active portal or suspended read-only portal according to
   account status.
