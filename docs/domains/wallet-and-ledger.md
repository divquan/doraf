# Wallet and ledger

Status: Discovery  
Last updated: 2026-07-30

## Sale credit

After Paystack payment is confirmed and the complete voucher allocation is
converted to sold, Doraf appends one agent profit credit to the wallet ledger.

The amount equals the immutable total agent profit snapshot on the order.
Notification delivery is not a prerequisite for the credit.

The credit must have a uniqueness constraint tied to the order's successful
sale so repeated callbacks, verification, or jobs cannot credit it twice.

## Balance

The agent-facing wallet balance is derived from ledger entries. Operators do not
edit the balance directly.

The wallet balance may be negative. The withdrawable amount cannot be negative;
it is zero whenever the wallet balance is zero or below.

Active withdrawal holds further reduce the withdrawable amount:

`withdrawable = max(0, ledger balance - active holds)`

The balance is limited to earnings and adjustments. Agents cannot top it up,
receive buyer deposits, transfer it to another user, earn interest, or spend it
inside Doraf.

## Payment reversal

If Paystack or another payment provider reverses a payment after its sale credit
was appended:

1. Preserve the original sale credit.
2. Append one reversal debit equal to the credited agent profit.
3. Link the debit to the provider reversal, original payment, order, and sale
   credit.
4. Recalculate the wallet balance, allowing it to become negative.
5. Prevent new withdrawals until the balance becomes positive.
6. Apply future sale credits against the negative balance automatically.

Reprocessing the same provider reversal must return the existing debit rather
than append another one.

If the provider later reinstates the payment, Doraf should append a compensating
credit rather than delete the reversal debit. The exact reinstatement workflow
remains to be confirmed.

A negative balance is a debt recorded against the agent wallet. Whether it
triggers collection activity or a maximum debt threshold remains open. It does
not automatically suspend new sales in the MVP. Doraf alerts Administrators and
allows future earnings to offset the debt.

## Withdrawal destination

MVP withdrawals go only to the agent's registered Ghana Mobile Money number.
The agent selects its current Mobile Money network. Doraf creates or reuses the
corresponding Paystack `mobile_money` transfer recipient and stores the returned
recipient code.

Changing the agent's registered phone number invalidates the previous active
withdrawal recipient and requires the manual account-recovery process.

Bank accounts and third-party Mobile Money numbers are outside the MVP.

## Withdrawal amount and fee

- Currency: GHS
- Minimum net payout: GHS 10
- Provider maximum net payout: GHS 50,000
- Doraf maximum: configurable and no higher than the provider maximum
- Agent-paid Mobile Money transfer fee: GHS 1

The request screen displays net payout, fee, and total wallet hold separately.
For example, a GHS 20 payout requires GHS 21 withdrawable and places a GHS 21
hold.

Paystack's limits and fee are external configuration. Doraf must verify them
before launch and monitor them for change.

## Withdrawal request

An agent:

1. Selects or confirms the registered phone's Mobile Money network.
2. Enters a valid net payout amount.
3. Reviews the GHS 1 fee and total wallet reduction.
4. Completes a fresh Doraf SMS OTP challenge.
5. Submits the request.

In one transaction, Doraf rechecks the wallet and places a hold for the net
payout plus fee. This prevents concurrent requests from spending the same
balance.

An agent with a non-positive or insufficient withdrawable amount cannot submit
the request.

## Administrator approval

Every MVP request requires Administrator approval. The Administrator can
approve or reject it with a recorded reason, and chooses the payout method per
withdrawal at approval time:

- **Paystack transfer** queues the request for provider initiation.
- **Manual payout** moves the request to `AWAITING_MANUAL_PAYMENT` and keeps the
  hold active until the Administrator records the out-of-band payment.

Immediately before Paystack initiation, Doraf rechecks:

- agent and wallet status,
- active hold,
- amount and fee snapshot,
- recipient details,
- provider limits, and
- whether a new reversal makes funds insufficient.

An insufficient wallet cancels the uninitiated withdrawal and releases its
hold.

Approved Paystack withdrawals use a unique Paystack reference. Paystack's
merchant transfer OTP remains enabled as a second operational approval control
during the MVP.

## Manual payout

A manually approved withdrawal (`AWAITING_MANUAL_PAYMENT`) is paid out of band
by an Administrator. To record the payment, the Administrator confirms the exact
net amount and enters a transaction reference; the action is serializable and
idempotent, so a retry cannot double-pay. Confirmation:

- appends the `PAYOUT_DEBIT` and `PAYOUT_FEE_DEBIT` ledger entries (unique on
  wallet, source type, and source id),
- consumes the hold,
- marks the withdrawal `SUCCESS`, and
- records a `WITHDRAWAL_MANUAL_PAID` audit event with the reference and actor.

The GHS 1 fee applies to manual payouts exactly as to Paystack payouts. The
agent sees the same `SUCCESS` outcome and ledger debits regardless of method.

An Administrator can cancel an `AWAITING_MANUAL_PAYMENT` withdrawal, which
releases the hold and marks it `CANCELLED`. Manual payout reversals are deferred;
a confirmed manual payout is terminal (see ADR-0014).

## Provider processing

Once submitted to Paystack:

- a non-terminal status retains the complete hold,
- `success` atomically appends payout and fee debits and releases the hold,
- `failed` atomically releases the hold, and
- `reversed` releases the hold when debits were not posted.

If Paystack reverses a transfer after success debits were posted, Doraf appends
compensating credits for money returned by the provider rather than deleting
the original debits. Treatment of a provider fee that is not returned must
match the provider settlement record.

Webhook and verification processing is idempotent. A provider event cannot
post, release, or compensate the same withdrawal more than once.

## Reversal while withdrawal is pending

If a sale-payment reversal arrives:

- Before provider initiation, cancel the withdrawal when funds become
  insufficient and release the hold.
- After provider initiation, retain the hold and allow the transfer to reach a
  terminal state.
- If the transfer succeeds and the sale reversal exceeds remaining funds, allow
  the ledger balance to become negative.

## Refund effect

A qualifying refund for one voucher unit appends one agent-profit reversal debit
equal to that unit's immutable profit snapshot. It does not edit the original
order-level sale credit.

The refund debit is unique to the refunded order unit and may make the wallet
negative. A replacement without refund has no agent-wallet effect.

Duplicate or excess payment refunds have no wallet effect because those
payments never created agent-profit credits.

## Agent visibility

The agent can see:

- ledger balance,
- held amount,
- withdrawable amount,
- requested net payout,
- fee,
- destination in masked form,
- withdrawal status,
- timestamps, and
- a safe failure reason when applicable.

Doraf sends status notifications by SMS. Exact notification points remain to be
defined.

## Remaining wallet questions

- Doraf's initial configurable maximum withdrawal amount
- Whether daily or rolling withdrawal limits apply
- Administrator response time expectations
- Request expiration before approval
- Handling of provider fee changes after a request is placed
- Debt collection or suspension thresholds
