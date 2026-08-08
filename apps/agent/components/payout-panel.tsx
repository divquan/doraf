"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@workspace/ui/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MoneySend01Icon,
  SmartPhone01Icon,
  Settings02Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { EarningsBalanceCard, EarningsSummary } from "./earnings-balance-card"
import { PayoutHistory } from "./_workspace/payout-history"
import { PayoutRequestForm } from "./_workspace/payout-request-form"
import { PayoutDestinationForm } from "./_workspace/payout-destination-form"
import {
  isPayoutDestination,
  PayoutDestinationData,
} from "./_workspace/payout-destination"
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
  | "AWAITING_MANUAL_PAYMENT"
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
  manualReference: string | null
}

export function PayoutPanel({
  phoneMask,
  destination,
  withdrawableMinor,
  earningsSummary,
  payouts,
  readOnly,
  transactions,
  pagination,
}: {
  phoneMask: string
  destination: PayoutDestinationData | null
  withdrawableMinor: string
  earningsSummary?: EarningsSummary
  payouts: AgentPayout[]
  readOnly: boolean
  transactions: TransactionItem[]
  pagination: PaginationMetadata
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"ledger" | "payouts">("ledger")
  const [modalOpen, setModalOpen] = useState(false)
  const [destModalOpen, setDestModalOpen] = useState(false)
  const [currentDestination, setCurrentDestination] =
    useState<PayoutDestinationData | null>(
      isPayoutDestination(destination) ? destination : null
    )
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [destSetupReturnsToRequest, setDestSetupReturnsToRequest] =
    useState(false)

  function handleOpenRequestModal() {
    setModalOpen(true)
  }

  function handleOpenDestinationSetup() {
    setDestSetupReturnsToRequest(true)
    setModalOpen(false)
    setDestModalOpen(true)
  }

  function handleCloseDestinationSetup() {
    setDestSetupReturnsToRequest(false)
    setDestModalOpen(false)
  }

  function handleDestinationSaved(newDestination: PayoutDestinationData) {
    setCurrentDestination(newDestination)
    setDestModalOpen(false)
    if (destSetupReturnsToRequest) {
      setDestSetupReturnsToRequest(false)
      setModalOpen(true)
    }
  }

  function handleRequestCreated() {
    setActiveTab("payouts")
    setSuccessMessage(
      "Your payout request has been submitted successfully and is awaiting review."
    )
    router.refresh()
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {/* 1. Top Earnings Balance Summary Card with Primary Request Payout Action */}
      {earningsSummary ? (
        <EarningsBalanceCard
          summary={earningsSummary}
          onRequestPayout={handleOpenRequestModal}
          readOnly={readOnly}
        />
      ) : null}

      {/* 2. Payout Destination & Secondary Request Action Banner */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HugeiconsIcon icon={SmartPhone01Icon} className="size-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                Mobile Money Payout Destination
              </div>
              {currentDestination ? (
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span>{currentDestination.network}</span>
                  <span className="text-muted-foreground">•</span>
                  <span>{currentDestination.accountName}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="font-mono">
                    {currentDestination.phoneMask}
                  </span>
                </div>
              ) : (
                <div className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  No payout destination set up yet
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCloseDestinationSetup}
              size="sm"
              variant="outline"
              disabled={readOnly}
              className="gap-1.5 text-xs font-medium"
            >
              <HugeiconsIcon icon={Settings02Icon} className="size-3.5" />
              {currentDestination ? "Change Destination" : "Set Up Destination"}
            </Button>
            {!earningsSummary ? (
              <Button
                onClick={handleOpenRequestModal}
                disabled={readOnly}
                size="sm"
                className="gap-1.5 text-xs font-semibold"
              >
                <HugeiconsIcon icon={MoneySend01Icon} className="size-3.5" />
                Request Payout
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {successMessage ? (
        <Alert className="flex items-center justify-between border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-3">
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              className="size-5 text-emerald-600 dark:text-emerald-400"
            />
            <div>
              <AlertTitle className="font-bold text-emerald-800 dark:text-emerald-300">
                Payout Request Submitted
              </AlertTitle>
              <AlertDescription className="text-xs">
                {successMessage}
              </AlertDescription>
            </div>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="cursor-pointer text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
          >
            Dismiss
          </button>
        </Alert>
      ) : null}

      {/* Logs Header */}
      <div className="flex items-center border-b border-border pb-2">
        <div className="flex border-b border-transparent">
          <button
            onClick={() => setActiveTab("ledger")}
            className={cn(
              "-mb-[10px] cursor-pointer border-b-2 px-4 py-2 text-sm font-semibold transition-all outline-none",
              activeTab === "ledger"
                ? "border-primary font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Ledger History
          </button>
          <button
            onClick={() => setActiveTab("payouts")}
            className={cn(
              "-mb-[10px] cursor-pointer border-b-2 px-4 py-2 text-sm font-semibold transition-all outline-none",
              activeTab === "payouts"
                ? "border-primary font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Payout Requests
          </button>
        </div>
      </div>

      {/* History table log */}
      <div className="w-full transition-all duration-200">
        {activeTab === "ledger" ? (
          <TransactionHistoryTable
            items={transactions}
            pagination={pagination}
          />
        ) : (
          <PayoutHistory payouts={payouts} />
        )}
      </div>

      {/* Payout Destination Setup Modal */}
      <Dialog
        open={destModalOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseDestinationSetup()
          else setDestModalOpen(true)
        }}
      >
        <DialogPopup className="max-w-md p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold">
              Payout destination setup
            </DialogTitle>
            <DialogDescription>
              Validate your Mobile Money account name with Paystack to receive
              commission payouts.
            </DialogDescription>
          </DialogHeader>
          <PayoutDestinationForm
            currentDestination={currentDestination}
            onSaved={handleDestinationSaved}
            onCancel={handleCloseDestinationSetup}
          />
        </DialogPopup>
      </Dialog>

      {/* Payout Request Form Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogPopup className="max-w-md p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold">
              Request payout
            </DialogTitle>
            <DialogDescription>
              Transfer available commissions to your validated Mobile Money
              account.
            </DialogDescription>
          </DialogHeader>
          {modalOpen && (
            <PayoutRequestForm
              phoneMask={phoneMask}
              destination={currentDestination}
              withdrawableMinor={withdrawableMinor}
              readOnly={readOnly}
              onRequestCreated={() => {
                handleRequestCreated()
                setModalOpen(false)
              }}
              onCancel={() => setModalOpen(false)}
              onOpenDestinationSetup={handleOpenDestinationSetup}
            />
          )}
        </DialogPopup>
      </Dialog>
    </div>
  )
}
