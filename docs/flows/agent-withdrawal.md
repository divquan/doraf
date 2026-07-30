# Agent withdrawal flow

Status: Confirmed product flow  
Last updated: 2026-07-30

## Preconditions

- The agent is signed in and not blocked from withdrawals.
- The destination is the agent's registered Ghana Mobile Money number.
- The Mobile Money network is selected.
- Wallet balance is positive.
- Withdrawable funds cover the net payout and GHS 1 fee.
- The payout is at least GHS 10 and no more than the effective Doraf and
  provider limit.

## Request

1. Enter the desired net payout.
2. Show the GHS 1 fee and total wallet reduction.
3. Show the masked registered Mobile Money destination and selected network.
4. Require a fresh Doraf SMS OTP.
5. Recheck available funds and request eligibility.
6. Create the withdrawal and atomically place a hold for payout plus fee.
7. Notify the agent that the request awaits Administrator approval.

## Administration

1. Administrator reviews agent, destination, amount, fee, wallet, reversal
   exposure, and relevant history.
2. Administrator approves or rejects with a reason.
3. Rejection releases the hold and notifies the agent.
4. Approval revalidates the request immediately before provider initiation.
5. If a new reversal makes funds insufficient, cancel and release the hold.
6. Otherwise, create or reuse the Paystack Mobile Money recipient.
7. Initiate the transfer using a unique reference.
8. Complete Paystack's merchant transfer OTP.

## Provider processing

- Retain the hold for every non-terminal status.
- On success, append payout and fee debits and release the hold atomically.
- On failure, release the hold atomically.
- On reversal before debits, release the hold.
- On reversal after debits, append compensating credits for returned funds.
- Reconcile missing webhooks through Paystack transfer verification.

Every provider transition is idempotent.

## Negative balance

If a sale-payment reversal arrives after Paystack processing began, do not
pretend the transfer can be cancelled. Let it reach a terminal status.

If it succeeds and the reversal exceeds remaining funds:

- allow the wallet balance to become negative,
- set withdrawable funds to zero,
- alert Administrators,
- block additional withdrawal requests, and
- apply future sale credits against the negative balance.

New sales are not automatically suspended.

## External constraints

As of 2026-07-30, Paystack documents:

- Ghana Mobile Money transfer support,
- GHS 10 minimum and GHS 50,000 maximum single transfers,
- a GHS 1 successful Mobile Money transfer fee,
- unique transfer references,
- webhook-based final status, and
- merchant transfer OTP or other configured transfer approval.

These are external constraints, not permanent Doraf constants. Verify them
before launch and monitor them for change.

Official references:

- https://paystack.com/docs/transfers/single-transfers/
- https://paystack.com/docs/transfers/
- https://support.paystack.com/en/articles/2132866
- https://support.paystack.com/en/articles/2130370
