"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  MoneyReceiveCircleIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { Separator } from "@workspace/ui/components/separator"
import { Spinner } from "@workspace/ui/components/spinner"

export interface AdminWithdrawal {
  id: string
  state: WithdrawalState
  netAmountMinor: string
  feeAmountMinor: string
  holdAmountMinor: string
  destinationMask: string
  network: string
  requestedAt: string
  decisionReason?: string | null
  transferStatus: string | null
  transferUpdatedAt: string | null
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
  | "SUBMITTED"
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "REVERSED"

export function WithdrawalOperations({
  withdrawals,
}: {
  withdrawals: AdminWithdrawal[]
}) {
  const active = withdrawals.filter((item) => !isTerminal(item.state))
  const recent = withdrawals
    .filter((item) => isTerminal(item.state))
    .slice(0, 12)

  return (
    <div className="flex flex-col gap-5">
      {active.length === 0 ? (
        <Empty className="min-h-48 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={MoneyReceiveCircleIcon} />
            </EmptyMedia>
            <EmptyTitle>No withdrawals need attention</EmptyTitle>
            <EmptyDescription>
              New agent requests and transfers awaiting Paystack action will
              appear here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {active.map((withdrawal) => (
            <WithdrawalCard key={withdrawal.id} withdrawal={withdrawal} />
          ))}
        </div>
      )}

      {recent.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent outcomes</CardTitle>
            <CardDescription>
              The latest completed, rejected, failed, or reversed requests.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {recent.map((withdrawal, index) => (
              <div key={withdrawal.id}>
                {index > 0 ? <Separator className="mb-3" /> : null}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">
                      {withdrawal.agent.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(withdrawal.requestedAt)} ·{" "}
                      {withdrawal.destinationMask}
                    </p>
                    {withdrawal.decisionReason ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {withdrawal.decisionReason}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {money(withdrawal.netAmountMinor)}
                    </p>
                    <StateBadge state={withdrawal.state} />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function WithdrawalCard({ withdrawal }: { withdrawal: AdminWithdrawal }) {
  const router = useRouter()
  const [reason, setReason] = useState("")
  const [otp, setOtp] = useState("")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function decide(action: "approve" | "reject") {
    if (reason.trim().length < 3) {
      setMessage("Enter a decision reason of at least three characters.")
      return
    }
    await perform(action, { reason: reason.trim() })
  }

  async function finalize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await perform("finalize", { otp })
  }

  async function perform(
    action: "approve" | "reject" | "verify" | "finalize",
    values: { reason?: string; otp?: string } = {}
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
      setMessage(actionMessage(action))
      router.refresh()
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "The action could not be completed"
      )
    } finally {
      setPending(false)
    }
  }

  const awaitingDecision = withdrawal.state === "REQUESTED"
  const awaitingOtp = withdrawal.state === "AWAITING_MERCHANT_OTP"
  const canVerify =
    Boolean(withdrawal.transferStatus) &&
    ["APPROVED", "SUBMITTED", "PENDING"].includes(withdrawal.state)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{withdrawal.agent.name}</CardTitle>
            <CardDescription className="mt-1">
              Requested {formatDate(withdrawal.requestedAt)}
            </CardDescription>
          </div>
          <StateBadge state={withdrawal.state} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Metric
            label="Agent receives"
            value={money(withdrawal.netAmountMinor)}
          />
          <Metric
            label="Wallet hold"
            value={money(withdrawal.holdAmountMinor)}
          />
          <Metric label="Destination" value={withdrawal.destinationMask} />
          <Metric label="Network" value={networkLabel(withdrawal.network)} />
        </div>
        {withdrawal.agent.status !== "ACTIVE" ? (
          <Alert variant="destructive">
            <AlertDescription>
              This agent is suspended. Approval will cancel the request during
              eligibility revalidation.
            </AlertDescription>
          </Alert>
        ) : null}
        {withdrawal.transferStatus ? (
          <p className="text-xs text-muted-foreground">
            Paystack status: {withdrawal.transferStatus}
            {withdrawal.transferUpdatedAt
              ? ` · checked ${formatDate(withdrawal.transferUpdatedAt)}`
              : ""}
          </p>
        ) : null}
        {awaitingDecision ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`reason-${withdrawal.id}`}>
                Decision reason
              </FieldLabel>
              <Input
                id={`reason-${withdrawal.id}`}
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
        ) : null}
        {awaitingOtp ? (
          <form id={`otp-${withdrawal.id}`} onSubmit={finalize}>
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
          </form>
        ) : null}
        {message ? (
          <Alert>
            <HugeiconsIcon icon={CheckmarkCircle02Icon} />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {awaitingDecision ? (
          <>
            <Button
              disabled={
                pending ||
                reason.trim().length < 3 ||
                withdrawal.agent.status !== "ACTIVE"
              }
              onClick={() => decide("approve")}
              type="button"
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}Approve
            </Button>
            <Button
              disabled={pending || reason.trim().length < 3}
              onClick={() => decide("reject")}
              type="button"
              variant="outline"
            >
              Reject
            </Button>
          </>
        ) : null}
        {awaitingOtp ? (
          <Button
            disabled={pending || otp.length !== 6}
            form={`otp-${withdrawal.id}`}
            type="submit"
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}Submit
            Paystack OTP
          </Button>
        ) : null}
        {canVerify ? (
          <Button
            disabled={pending}
            onClick={() => perform("verify")}
            type="button"
            variant="outline"
          >
            <HugeiconsIcon icon={RefreshIcon} data-icon="inline-start" />
            Verify with Paystack
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
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
    SUBMITTED: "Submitted",
    PENDING: "Processing",
    SUCCESS: "Paid",
    FAILED: "Failed",
    REVERSED: "Reversed",
  }
  return labels[state]
}

function money(value: string) {
  const minor = BigInt(value)
  return `GHS ${minor / 100n}.${(minor % 100n).toString().padStart(2, "0")}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Accra",
  }).format(new Date(value))
}

function networkLabel(value: string) {
  return value === "MTN"
    ? "MTN MoMo"
    : value === "TELECEL"
      ? "Telecel Cash"
      : "AT Money"
}

function actionMessage(action: "approve" | "reject" | "verify" | "finalize") {
  return action === "approve"
    ? "Withdrawal approved and queued for Paystack."
    : action === "reject"
      ? "Withdrawal rejected and its hold released."
      : action === "finalize"
        ? "Paystack OTP submitted."
        : "Transfer status refreshed from Paystack."
}
