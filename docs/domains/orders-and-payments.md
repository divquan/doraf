# Orders and payments

Status: Discovery  
Last updated: 2026-07-30

## Responsibilities

This domain owns:

- durable orders,
- payment attempts,
- Paystack transaction references,
- Mobile Money payer details,
- payment status reconciliation, and
- the trigger indicating that an order is eligible for fulfillment.

The web order and Paystack payment lifecycle is confirmed below. USSD-specific
behavior uses the same core lifecycle. Some exception policies remain open.

## Web checkout

Checkout receives:

- the agent-attributed sales link,
- one checker product,
- a quantity from one to five,
- the required delivery number entered twice,
- an optional delivery email entered twice,
- the Mobile Money payer number, and
- the payer's Mobile Money network.

Before the buyer confirms, Doraf displays:

- the selected checker's supported examination types,
- the three-use and candidate-lock restriction,
- quantity,
- unit and total retail price,
- delivery phone number, and
- optional delivery email.

Confirmation creates a durable order and immutable commercial snapshot before
inventory reservation and payment initialization.

## Order snapshot

The confirmed order stores at least:

- unique order reference,
- agent and tenant attribution,
- sales-channel attribution,
- product and quantity,
- currency,
- base unit price,
- retail unit price,
- agent profit per unit and in total,
- required delivery phone number,
- optional delivery email,
- Mobile Money payer number and network, and
- creation time.

Payment success makes the pricing and delivery snapshot immutable. Whether a
still-unpaid order can be corrected or must be replaced remains open.

## USSD checkout

USSD checkout creates the same order and payment-attempt records as web
checkout. The source channel identifies USSD and preserves the resolved agent
referral-code attribution.

The USSD session phone number defaults both the required delivery number and
Mobile Money payer number. The buyer can replace either value and selects the
payer network. USSD does not collect optional delivery email.

After payment initiation, the USSD session returns instructions and ends.
Payment confirmation and all downstream work are asynchronous and must not
depend on session state remaining available.

## Guest payment identity

Doraf does not require a guest buyer to provide an email address. The checkout
collects the Mobile Money payer phone number required for payment, which may
differ from the voucher delivery number. A buyer may optionally provide a real
email address as a second voucher-delivery channel.

Paystack requires an email field when initializing a transaction. Doraf
satisfies the integration requirement by generating a synthetic email:

```text
<normalized-payer-number>@guest.<doraf-controlled-domain>
```

For example, the Ghana number `0241234567` may normalize to a digits-only
international representation before being placed in the local part. The exact
normalization format and production domain must be fixed before implementation.

## Synthetic-email rules

- Generate the value on Doraf's backend.
- Derive it from the Mobile Money payer number, not the voucher delivery number.
- Use a domain controlled by Doraf.
- Store it on the payment-attempt record alongside the payer number.
- Pass it to Paystack as the required customer email.
- Never describe it as a buyer-provided email.
- Never display it as a buyer contact method.
- Never use it for Doraf marketing or transactional communication.
- Treat it as personal data because it is directly derived from a phone number.
- Do not put it in ordinary application logs.
- Do not replace it with the optional buyer-provided delivery email in Paystack
  requests.

Whether the guest subdomain rejects mail, accepts mail into a restricted
sink, or is configured another way remains an operational decision. It must not
create a mailbox accessible to another customer.

## Optional delivery email

When supplied, the buyer-provided delivery email:

- is stored on the order, not as the Paystack customer identity,
- receives the same serial-number/PIN pairs delivered by SMS,
- applies to every voucher in the order,
- is optional and does not replace the required SMS delivery number, and
- must be clearly distinguished from the synthetic Paystack email in storage,
  code, administration tools, and logs.

Email confirmation, retry, masking, retention, and correction rules will be
defined with the fulfillment flow.

## Payment references

Every Paystack initialization must use a unique Doraf-generated reference and
persist it before or atomically with the external request. The synthetic email
is not an order identifier or idempotency key.

One order may have multiple payment attempts, but one successful payment must
fulfill and credit the order only once.

A retry after terminal failure uses:

- the same order and pricing snapshot,
- a new payment-attempt record,
- a new unique Paystack reference, and
- a fresh inventory reservation.

An order accepts at most three payment attempts and retains its original price
for 15 minutes after buyer confirmation. Only one attempt may be active at a
time.

After 15 minutes, the buyer must create a new order using current pricing. The
deadline prevents new attempts but does not invalidate an attempt initiated
before it.

## Paystack Mobile Money timing

Paystack currently documents a 180-second customer authorization window for
Ghana Mobile Money. This provider behavior should be verified during
integration and treated as configuration where practical.

Inventory reservation covers the authorization window. When no success webhook
arrives, Doraf verifies the transaction before releasing the reservation.
Terminal failure or abandonment releases the inventory; success sells it; a
non-terminal response retains it for a short configurable reconciliation grace
period. The confirmed grace period is five minutes after the initial
180-second window.

## Successful-payment transaction

After authenticating the Paystack webhook or obtaining a verification result,
Doraf must also match the provider reference, currency, amount, and expected
order before accepting success.

One short database transaction then:

1. records the payment attempt as successful,
2. marks the order paid,
3. converts every reserved voucher to sold,
4. appends the agent's wallet credit, and
5. records durable SMS and optional email delivery work.

The transaction either commits all internal commercial effects or none of them.
External SMS and email API calls occur after commit.

Repeated webhooks, verification results, jobs, or operator retries must find the
existing effects rather than create duplicates.

## Failure behavior

- A terminal Paystack failure marks the attempt failed and releases its
  reservation.
- A missing webhook triggers verification before inventory release.
- A non-terminal verification result retains the reservation for a configurable
  five-minute grace period and schedules another check.
- After that grace period, Doraf releases the reservation but continues
  background reconciliation.
- A failure on one attempt does not make a later attempt reuse its Paystack
  reference.
- Once any attempt succeeds, further attempts cannot charge or fulfill the
  order.
- Notification failure does not change payment or order-paid status.

## Late and duplicate success

If background reconciliation discovers success after inventory was released:

1. Atomically allocate the complete quantity from fresh inventory.
2. Apply the normal paid-order, sold-inventory, wallet-credit, and delivery
   transaction if allocation succeeds.
3. If complete inventory is unavailable, place the paid order in an operational
   exception queue for Administrator refund.

If more than one payment attempt succeeds:

- fulfill the order once,
- credit agent profit once,
- record every additional successful charge as an excess payment, and
- send each excess payment through the refund workflow.

Unexpected duplicate success must never allocate additional vouchers unless the
buyer creates and pays for another order.

## Payment mismatch

Do not accept provider success when its reference, currency, or amount differs
from the expected payment attempt. Preserve the provider payload safely, mark
the attempt for investigation, and do not allocate inventory or credit the
agent.

## Refund boundary

A voucher whose serial number and PIN were delivered is normally
non-refundable because the secret has been exposed.

Refunds are permitted for:

- duplicate or excess payments, and
- paid orders Doraf cannot fulfill or recover.

When an original allocation cannot be fulfilled, an Administrator first tries
audited replacement inventory. If replacement cannot complete the purchased
quantity, the order proceeds to refund.

## Post-sale payment reversal

A provider reversal after fulfillment does not make sold vouchers available
again. Doraf records the payment reversal and appends one corresponding debit
for the agent profit to the wallet ledger.

The debit is idempotent and linked to the original payment, order, and sale
credit. It may make the agent's wallet balance negative.

## State dimensions

Payment, inventory, and delivery status should be modeled separately rather
than compressed into one ambiguous order status.

At minimum, the system needs to distinguish:

- unpaid from paid orders,
- active, failed, and successful payment attempts,
- available, reserved, and sold vouchers, and
- pending, delivered, and failed delivery attempts.

The implemented schema keeps these dimensions in separate enums and records.

## Implemented foundation

The first web-checkout slice persists the order, itemized commercial snapshot,
initial payment attempt, and complete voucher reservation atomically. Contact
and synthetic-email values are encrypted and only masks leave the API. The
payment attempt remains in `CREATED` until the Paystack adapter processes its
durable initialization work; no provider call occurs inside the transaction.

Uninitialized attempts may release after their 180-second reservation expires.
Initialized or ambiguous attempts must use Paystack verification and the
confirmed five-minute reconciliation grace period before release.
