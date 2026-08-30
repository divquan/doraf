# Daily reconciliation flow

Status: Confirmed product flow  
Last updated: 2026-07-30

## Start

1. Select the completed `Africa/Accra` reporting date.
2. Record source cut-off timestamps.
3. Create an immutable reconciliation-run identity.
4. Read canonical provider and Dashchecker records without changing them.

## Reconcile

1. Match Paystack charges, attempts, orders, allocations, and wallet credits.
2. Match refunds and payment reversals to payment and wallet effects.
3. Reconcile inventory transitions and batch/product closing counts.
4. Match withdrawal holds, approvals, Paystack transfers, and ledger entries.
5. Match provider fees and settlements to the related populations.
6. Match SMS and email billable events to delivery attempts.
7. Calculate canonical sales, agent liability, agent debt, base revenue, cost,
   and contribution totals.

## Exceptions

For each mismatch:

1. Create or link an assignable discrepancy case.
2. Record category, severity, affected value or items, and evidence.
3. Route it to the appropriate operational queue.
4. Do not edit the mismatched source record.

## Close

1. Record matched and unmatched totals.
2. Record case identifiers.
3. Require operator review of blocking discrepancies.
4. Close the run with operator and completion timestamp.
5. Make the run inputs and results immutable.

Late events appear in a later adjustment run or resolve a linked discrepancy
case. They do not silently rewrite the closed daily run.
