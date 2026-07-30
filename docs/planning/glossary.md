# Glossary

Status: Draft  
Last updated: 2026-07-30

| Term | Working definition |
| --- | --- |
| Agent | A platform user who markets PINs through attributed sales channels and earns the difference defined by the pricing model. |
| Buyer | The person completing a purchase. The buyer may or may not be the student or Mobile Money account holder. |
| Student | The intended user of the WAEC result-checking PIN. |
| Tenant | The data and authorization boundary associated with an agent account. Whether a tenant can contain multiple users is undecided. |
| Sales channel | An agent-attributed route through which a buyer starts a purchase, currently a web link or USSD code. |
| Agent referral code | The permanent unique code that attributes a USSD purchase to one agent and is never reassigned. |
| PIN | A secret digital credential used to access a WAEC result-checking service. |
| Serial number | The alphanumeric identifier paired with a voucher's PIN and required by the official WAEC result portal. |
| Voucher | One sellable WAEC Checker consisting of an inseparable serial-number and 12-digit PIN pair. |
| BECE Checker | A voucher supporting BECE School and BECE Private results across all years. |
| WASSCE Checker | A voucher supporting WASSCE School results across all years. |
| NOV/DEC (Private) Checker | A voucher supporting WASSCE Private, ABCE, and GBCE results across all years. |
| Inventory item | One unused or sold voucher and its lifecycle metadata held centrally by the platform. |
| Retail price | The amount presented to and charged to the buyer, subject to unresolved fee rules. |
| Platform cost | The platform's acquisition cost for a PIN, subject to rules for batches and changing costs. |
| Profit margin | The amount credited to an agent for a completed sale. Its exact formula is not yet confirmed. |
| Wallet | The agent-facing representation of money owed to or held for the agent. It should not be treated as the accounting system itself. |
| Ledger | The auditable record of financial entries from which balances are derived. |
| Withdrawable balance | Funds currently eligible for payout under the platform's withdrawal and risk rules. |
| Held amount | Wallet funds reserved for active withdrawal requests and unavailable for another withdrawal. |
| Order | The durable commercial record connecting an agent, buyer contact, product quantities, prices, payment, allocated vouchers, and fulfillment. |
| Payment attempt | One attempt to collect an order's payment through a provider, identified by its own unique provider reference. |
| Synthetic email | A backend-generated email-shaped identifier derived from the payer number solely to satisfy Paystack's required email field. |
| Fulfillment | Allocation and delivery of serial-number/PIN pairs for a successfully paid order. |
