"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@workspace/ui/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoneySend01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import { PayoutHistory } from "./_workspace/payout-history"
import { PayoutRequestForm } from "./_workspace/payout-request-form"
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  TransactionHistoryTable,
  TransactionItem,
  PaginationMetadata,
} from "./transaction-history-table"

export type Step = "details" | "otp" | "verified"

export type PayoutState =
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

export interface AgentPayout {
  id: string
  state: PayoutState
  netAmountMinor: string
  feeAmountMinor: string
  holdAmountMinor: string
  destinationMask: string
  network: string
  requestedAt: string
  decidedAt: string | null
  decisionReason: string | null
}

export function PayoutPanel({
  phoneMask,
  withdrawableMinor,
  payouts,
  readOnly,
  transactions,
  pagination,
}: {
  phoneMask: string
  withdrawableMinor: string
  payouts: AgentPayout[]
  readOnly: boolean
  transactions: TransactionItem[]
  pagination: PaginationMetadata
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"ledger" | "payouts">("ledger")
  const [modalOpen, setModalOpen] = useState(false)

  function handleRequestCreated() {
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Logs Header and Payout Trigger */}
      <div className="flex flex-wrap items-center justify-between border-b border-border pb-2 gap-4">
        <div className="flex border-b border-transparent">
          <button
            onClick={() => setActiveTab("ledger")}
            className={cn(
              "px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer outline-none -mb-[10px]",
              activeTab === "ledger"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Ledger History
          </button>
          <button
            onClick={() => setActiveTab("payouts")}
            className={cn(
              "px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer outline-none -mb-[10px]",
              activeTab === "payouts"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Payout Requests
          </button>
        </div>

        <Button
          onClick={() => setModalOpen(true)}
          disabled={readOnly}
          size="sm"
          className="font-semibold gap-1.5"
        >
          <HugeiconsIcon icon={MoneySend01Icon} className="size-4" />
          Request Payout
        </Button>
      </div>

      {/* History table log */}
      <div className="transition-all duration-200 w-full">
        {activeTab === "ledger" ? (
          <TransactionHistoryTable
            items={transactions}
            pagination={pagination}
          />
        ) : (
          <PayoutHistory payouts={payouts} />
        )}
      </div>

      {/* Payout Form Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogPopup className="max-w-md p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold">Request payout</DialogTitle>
            <DialogDescription>
              Transfer available commissions to your registered Mobile Money account.
            </DialogDescription>
          </DialogHeader>
          {modalOpen && (
            <PayoutRequestForm
              phoneMask={phoneMask}
              withdrawableMinor={withdrawableMinor}
              readOnly={readOnly}
              onRequestCreated={() => {
                handleRequestCreated()
                setModalOpen(false)
              }}
              onCancel={() => setModalOpen(false)}
            />
          )}
        </DialogPopup>
      </Dialog>
    </div>
  )
}
