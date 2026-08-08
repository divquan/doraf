"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  MoneyReceiveCircleIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { cn } from "@workspace/ui/lib/utils"
import { formatDateTime, formatMoney, ghsToPesewas } from "@/lib/format"

export interface AdminWithdrawal {
  id: string
  state: WithdrawalState
  payoutMethod: "PAYSTACK" | "MANUAL"
  netAmountMinor: string
  feeAmountMinor: string
  holdAmountMinor: string
  destinationMask: string
  network: string
  requestedAt: string
  decisionReason?: string | null
  transferStatus: string | null
  transferUpdatedAt: string | null
  manualPaidAt: string | null
  manualReference: string | null
  manualPaidByName: string | null
  agent: {
    id: string
    name: string
    phoneMask: string
    status: "ACTIVE" | "SUSPENDED"
  }
}

type WithdrawalState =
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

type WithdrawalAction =
  | "approve"
  | "reject"
  | "verify"
  | "finalize"
  | "mark-paid"
  | "cancel"

type ConfirmAction = WithdrawalAction | null

interface RowMessage {
  text: string
  tone: "success" | "error"
}

const PAGE_SIZE = 10

export function WithdrawalOperations({
  withdrawals,
}: {
  withdrawals: AdminWithdrawal[]
}) {
  const [page, setPage] = useState(1)
  const sorted = sortWithdrawals(withdrawals)
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * PAGE_SIZE
  const visible = sorted.slice(start, start + PAGE_SIZE)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Withdrawal requests</CardTitle>
            <CardDescription>
              Review held wallet funds, approve Paystack or manual payouts, and
              reconcile outcomes.
            </CardDescription>
          </div>
          <Badge variant="outline">
            {withdrawals.length}{" "}
            {withdrawals.length === 1 ? "request" : "requests"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {visible.length === 0 ? (
          <Empty className="min-h-48 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={MoneyReceiveCircleIcon} />
              </EmptyMedia>
              <EmptyTitle>No withdrawals yet</EmptyTitle>
              <EmptyDescription>
                Agent payout requests will appear here for review.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((withdrawal) => (
                    <WithdrawalRow
                      key={withdrawal.id}
                      withdrawal={withdrawal}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            {sorted.length > PAGE_SIZE ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <HugeiconsIcon
                      data-icon="inline-start"
                      icon={ArrowLeft02Icon}
                    />
                    Previous
                  </Button>
                  <Button
                    disabled={currentPage === totalPages}
                    onClick={() => setPage(currentPage + 1)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Next
                    <HugeiconsIcon
                      data-icon="inline-end"
                      icon={ArrowRight02Icon}
                    />
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function WithdrawalRow({ withdrawal }: { withdrawal: AdminWithdrawal }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<RowMessage | null>(null)
  const [reason, setReason] = useState("")
  const [otp, setOtp] = useState("")
  const [payoutMethod, setPayoutMethod] = useState<"PAYSTACK" | "MANUAL">(
    "PAYSTACK"
  )
  const [reference, setReference] = useState("")
  const [confirmedAmount, setConfirmedAmount] = useState("")
  const [note, setNote] = useState("")
  const [confirm, setConfirm] = useState<ConfirmAction>(null)

  async function perform(
    action: WithdrawalAction,
    values: {
      reason?: string
      otp?: string
      payoutMethod?: "PAYSTACK" | "MANUAL"
      reference?: string
      confirmedNetAmountMinor?: string
    } = {}
  ) {
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/withdrawals/${withdrawal.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...values }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        message?: string
      }
      if (!response.ok)
        throw new Error(body.message ?? "The action could not be completed")
      setMessage({
        text: actionMessage(action, values.payoutMethod),
        tone: "success",
      })
      router.refresh()
    } catch (cause) {
      setMessage({
        text:
          cause instanceof Error
            ? cause.message
            : "The action could not be completed",
        tone: "error",
      })
    } finally {
      setPending(false)
    }
  }

  function confirmDialogAction() {
    const action = confirm
    setConfirm(null)
    if (action === "approve") {
      void perform("approve", { reason: reason.trim(), payoutMethod })
    } else if (action === "reject") {
      void perform("reject", { reason: reason.trim() })
    } else if (action === "mark-paid") {
      void perform("mark-paid", {
        reference: reference.trim(),
        confirmedNetAmountMinor: confirmedPesewas?.toString() ?? "",
        reason: note.trim() || undefined,
      })
    } else if (action === "cancel") {
      void perform("cancel", { reason: reason.trim() })
    } else if (action === "finalize") {
      void perform("finalize", { otp })
    }
  }

  const confirmedPesewas =
    confirmedAmount.trim() === "" ? null : ghsToPesewas(confirmedAmount)
  const amountMatches =
    confirmedPesewas !== null &&
    confirmedPesewas === BigInt(withdrawal.netAmountMinor)

  const awaitingDecision = withdrawal.state === "REQUESTED"
  const awaitingManualPaid = withdrawal.state === "AWAITING_MANUAL_PAYMENT"
  const awaitingOtp = withdrawal.state === "AWAITING_MERCHANT_OTP"
  const canVerify =
    Boolean(withdrawal.transferStatus) &&
    ["APPROVED", "SUBMITTED", "PENDING"].includes(withdrawal.state)
  const confirmValid =
    confirm === "approve" || confirm === "reject"
      ? reason.trim().length >= 3
      : confirm === "mark-paid"
        ? reference.trim().length >= 3 && amountMatches
        : confirm === "cancel"
          ? reason.trim().length >= 3
          : otp.length === 6

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{withdrawal.agent.name}</p>
        <p className="text-xs text-muted-foreground">
          {withdrawal.agent.phoneMask}
        </p>
        {withdrawal.agent.status !== "ACTIVE" ? (
          <p className="text-xs text-destructive">Suspended</p>
        ) : null}
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
        {formatDateTime(withdrawal.requestedAt)}
      </TableCell>
      <TableCell>
        <p className="text-sm">{withdrawal.destinationMask}</p>
        <p className="text-xs text-muted-foreground">
          {networkLabel(withdrawal.network)}
        </p>
      </TableCell>
      <TableCell className="text-right font-mono font-semibold whitespace-nowrap">
        {formatMoney(withdrawal.netAmountMinor)}
      </TableCell>
      <TableCell>
        <div className="flex flex-col items-start gap-1">
          <StateBadge state={withdrawal.state} />
          {withdrawal.payoutMethod === "MANUAL" ? (
            <p className="text-[11px] text-muted-foreground">Manual payout</p>
          ) : null}
          {withdrawal.transferStatus ? (
            <p className="text-[11px] text-muted-foreground">
              {withdrawal.transferStatus}
            </p>
          ) : null}
          {withdrawal.manualReference ? (
            <p className="max-w-40 truncate text-[11px] text-muted-foreground">
              Ref: {withdrawal.manualReference}
            </p>
          ) : null}
          {withdrawal.manualPaidByName ? (
            <p className="max-w-40 truncate text-[11px] text-muted-foreground">
              Paid by {withdrawal.manualPaidByName}
            </p>
          ) : null}
          {withdrawal.decisionReason ? (
            <p className="max-w-40 truncate text-[11px] text-muted-foreground">
              {withdrawal.decisionReason}
            </p>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center justify-end gap-2">
            {awaitingDecision ? (
              <>
                <Button
                  disabled={withdrawal.agent.status !== "ACTIVE"}
                  onClick={() => setConfirm("approve")}
                  size="sm"
                  type="button"
                >
                  Approve
                </Button>
                <Button
                  onClick={() => setConfirm("reject")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Reject
                </Button>
              </>
            ) : awaitingManualPaid ? (
              <>
                <Button
                  onClick={() => setConfirm("mark-paid")}
                  size="sm"
                  type="button"
                >
                  Mark paid
                </Button>
                <Button
                  onClick={() => setConfirm("cancel")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              </>
            ) : awaitingOtp ? (
              <Button
                onClick={() => setConfirm("finalize")}
                size="sm"
                type="button"
              >
                Submit OTP
              </Button>
            ) : canVerify ? (
              <Button
                onClick={() => void perform("verify")}
                size="sm"
                type="button"
                variant="outline"
              >
                <HugeiconsIcon data-icon="inline-start" icon={RefreshIcon} />
                Verify
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
          {pending ? <Spinner className="size-4" /> : null}
          {message ? (
            <p
              className={cn(
                "max-w-56 text-right text-xs",
                message.tone === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
              role="status"
            >
              {message.text}
            </p>
          ) : null}
        </div>
      </TableCell>
      <Dialog
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        open={confirm !== null}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>
              {confirm === "approve"
                ? "Approve this withdrawal?"
                : confirm === "reject"
                  ? "Reject this withdrawal?"
                  : confirm === "mark-paid"
                    ? "Confirm manual payout?"
                    : confirm === "cancel"
                      ? "Cancel manual payout?"
                      : "Submit Paystack OTP?"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "approve"
                ? payoutMethod === "MANUAL"
                  ? "You will pay the agent manually (for example Mobile Money) and confirm payment here. The wallet hold stays active until you confirm."
                  : "The request will be queued for transfer to the agent's validated destination via Paystack."
                : confirm === "reject"
                  ? "The request will be rejected and its wallet hold released."
                  : confirm === "mark-paid"
                    ? "The wallet hold will be consumed and the payout debited from the agent's wallet. This cannot be undone."
                    : confirm === "cancel"
                      ? "The request will be cancelled and its wallet hold released."
                      : "The transfer approval code will be submitted to Paystack to complete the payout."}
            </DialogDescription>
          </DialogHeader>
          {confirm === "approve" ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`withdrawal-reason-${withdrawal.id}`}>
                  Decision reason
                </FieldLabel>
                <Input
                  id={`withdrawal-reason-${withdrawal.id}`}
                  minLength={3}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Reviewed wallet and destination"
                  value={reason}
                />
                <FieldDescription>
                  This reason is written to the audit history.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Payout method</FieldLabel>
                <ToggleGroup
                  className="w-full justify-start gap-2"
                  onValueChange={(values) => {
                    const next = values[0]
                    if (next === "PAYSTACK" || next === "MANUAL")
                      setPayoutMethod(next)
                  }}
                  value={[payoutMethod]}
                  variant="outline"
                >
                  <ToggleGroupItem value="PAYSTACK" className="flex-1">
                    Paystack transfer
                  </ToggleGroupItem>
                  <ToggleGroupItem value="MANUAL" className="flex-1">
                    Manual payout
                  </ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription>
                  {payoutMethod === "MANUAL"
                    ? "You pay the agent yourself and confirm the payment here."
                    : "Paystack initiates the transfer to the agent's validated destination."}
                </FieldDescription>
              </Field>
            </FieldGroup>
          ) : confirm === "reject" || confirm === "cancel" ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`withdrawal-reason-${withdrawal.id}`}>
                  Decision reason
                </FieldLabel>
                <Input
                  id={`withdrawal-reason-${withdrawal.id}`}
                  minLength={3}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Reviewed wallet and destination"
                  value={reason}
                />
                <FieldDescription>
                  This reason is written to the audit history.
                </FieldDescription>
              </Field>
            </FieldGroup>
          ) : confirm === "mark-paid" ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`manual-ref-${withdrawal.id}`}>
                  Transaction reference
                </FieldLabel>
                <Input
                  id={`manual-ref-${withdrawal.id}`}
                  minLength={3}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="MoMo transaction reference"
                  value={reference}
                />
                <FieldDescription>
                  Recorded in the audit history and shown to the agent after
                  payment is confirmed.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={`manual-amount-${withdrawal.id}`}>
                  Confirm net payout amount
                </FieldLabel>
                <Input
                  id={`manual-amount-${withdrawal.id}`}
                  inputMode="decimal"
                  onChange={(event) => setConfirmedAmount(event.target.value)}
                  placeholder={`e.g. ${(Number(withdrawal.netAmountMinor) / 100).toFixed(2)}`}
                  value={confirmedAmount}
                />
                <FieldDescription>
                  Type the exact payout amount shown (
                  {formatMoney(withdrawal.netAmountMinor)}) to release the hold.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={`manual-note-${withdrawal.id}`}>
                  Note (optional)
                </FieldLabel>
                <Input
                  id={`manual-note-${withdrawal.id}`}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="e.g. Paid via MTN MoMo to the registered number"
                  value={note}
                />
              </Field>
            </FieldGroup>
          ) : confirm === "finalize" ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`merchant-otp-${withdrawal.id}`}>
                  Paystack merchant OTP
                </FieldLabel>
                <InputOTP
                  id={`merchant-otp-${withdrawal.id}`}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={setOtp}
                  pattern="^[0-9]*$"
                  value={otp}
                >
                  <InputOTPGroup>
                    {Array.from({ length: 6 }, (_, index) => (
                      <InputOTPSlot index={index} key={index} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <FieldDescription>
                  Enter the transfer approval code sent by Paystack.
                </FieldDescription>
              </Field>
            </FieldGroup>
          ) : null}
          <DialogFooter>
            <Button
              onClick={() => setConfirm(null)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={!confirmValid}
              onClick={confirmDialogAction}
              type="button"
            >
              {confirm === "approve"
                ? "Approve"
                : confirm === "reject"
                  ? "Reject"
                  : confirm === "mark-paid"
                    ? "Confirm paid"
                    : confirm === "cancel"
                      ? "Cancel request"
                      : "Submit OTP"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </TableRow>
  )
}

function StateBadge({ state }: { state: WithdrawalState }) {
  return (
    <Badge
      variant={
        ["REJECTED", "CANCELLED", "FAILED"].includes(state)
          ? "destructive"
          : state === "SUCCESS"
            ? "secondary"
            : "outline"
      }
    >
      {stateLabel(state)}
    </Badge>
  )
}

function sortWithdrawals(withdrawals: AdminWithdrawal[]) {
  const active = withdrawals.filter((item) => !isTerminal(item.state))
  const done = withdrawals.filter((item) => isTerminal(item.state))
  const activeSorted = [...active].sort(
    (a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt)
  )
  const doneSorted = [...done].sort(
    (a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt)
  )
  return [...activeSorted, ...doneSorted]
}

function isTerminal(state: WithdrawalState) {
  return ["REJECTED", "CANCELLED", "SUCCESS", "FAILED", "REVERSED"].includes(
    state
  )
}

function stateLabel(state: WithdrawalState) {
  const labels: Record<WithdrawalState, string> = {
    REQUESTED: "Review required",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
    AWAITING_MERCHANT_OTP: "Paystack OTP required",
    AWAITING_MANUAL_PAYMENT: "Manual payout pending",
    SUBMITTED: "Submitted",
    PENDING: "Processing",
    SUCCESS: "Paid",
    FAILED: "Failed",
    REVERSED: "Reversed",
  }
  return labels[state]
}

function networkLabel(value: string) {
  return value === "MTN"
    ? "MTN MoMo"
    : value === "TELECEL"
      ? "Telecel Cash"
      : "AT Money"
}

function actionMessage(
  action: WithdrawalAction,
  payoutMethod?: "PAYSTACK" | "MANUAL"
) {
  return action === "approve"
    ? payoutMethod === "MANUAL"
      ? "Manual payout approved. Confirm payment to release the hold."
      : "Withdrawal approved and queued for Paystack."
    : action === "reject"
      ? "Withdrawal rejected and its hold released."
      : action === "mark-paid"
        ? "Manual payout recorded and the wallet updated."
        : action === "cancel"
          ? "Withdrawal cancelled and its hold released."
          : action === "finalize"
            ? "Paystack OTP submitted."
            : "Transfer status refreshed from Paystack."
}
