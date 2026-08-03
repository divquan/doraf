"use client"

import { useRouter } from "next/navigation"
import { WithdrawalHistory } from "./_workspace/withdrawal-history"
import { WithdrawalRequestForm } from "./_workspace/withdrawal-request-form"

export type Step = "details" | "otp" | "verified"

export type WithdrawalState =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "AWAITING_MERCHANT_OTP"
  | "SUBMITTED"
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "REVERSED"

export interface AgentWithdrawal {
  id: string
  state: WithdrawalState
  netAmountMinor: string
  feeAmountMinor: string
  holdAmountMinor: string
  destinationMask: string
  network: string
  requestedAt: string
  decidedAt: string | null
  decisionReason: string | null
}

export function WithdrawalPanel({
  phoneMask,
  withdrawableMinor,
  withdrawals,
  readOnly,
}: {
  phoneMask: string
  withdrawableMinor: string
  withdrawals: AgentWithdrawal[]
  readOnly: boolean
}) {
  const router = useRouter()

  function handleRequestCreated() {
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-5">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Withdraw funds</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Send available earnings to your registered Mobile Money number.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <WithdrawalRequestForm
            phoneMask={phoneMask}
            withdrawableMinor={withdrawableMinor}
            readOnly={readOnly}
            onRequestCreated={handleRequestCreated}
          />
        </div>
      </section>

      <section>
        <WithdrawalHistory withdrawals={withdrawals} />
      </section>
    </div>
  )
}
