"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  MoneyReceiveCircleIcon,
  SecurityCheckIcon,
} from "@hugeicons/core-free-icons"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select"
import { Separator } from "@workspace/ui/components/separator"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { pesewasToGhs } from "@/lib/money-format"

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

type Step = "details" | "otp" | "verified"

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
  const [step, setStep] = useState<Step>("details")
  const [amount, setAmount] = useState("")
  const [network, setNetwork] = useState("MTN")
  const [challengeId, setChallengeId] = useState("")
  const [code, setCode] = useState("")
  const [withdrawalToken, setWithdrawalToken] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Phase 3 states
  const [requestOpen, setRequestOpen] = useState(false)
  const [resendPending, setResendPending] = useState(false)
  const [resendStatus, setResendStatus] = useState<string | null>(null)

  const netAmountMinor = parseGhs(amount)
  const totalMinor = netAmountMinor === null ? null : netAmountMinor + 100n
  const canRequest =
    !readOnly &&
    totalMinor !== null &&
    netAmountMinor !== null &&
    netAmountMinor >= 1_000n &&
    netAmountMinor <= 5_000_000n &&
    totalMinor <= BigInt(withdrawableMinor)

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canRequest) return
    await run(async () => {
      const result = await readResponse<{ challengeId: string }>(
        await fetch("/api/withdrawals/otp", { method: "POST" })
      )
      setChallengeId(result.challengeId)
      setStep("otp")
    })
  }

  async function resendOtp() {
    setResendPending(true)
    setResendStatus(null)
    setError(null)
    try {
      const result = await readResponse<{ challengeId: string }>(
        await fetch("/api/withdrawals/otp", { method: "POST" })
      )
      setChallengeId(result.challengeId)
      setCode("")
      setResendStatus("Code resent")
      setTimeout(() => setResendStatus(null), 3000)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not resend code")
    } finally {
      setResendPending(false)
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await run(async () => {
      const result = await readResponse<{ withdrawalToken: string }>(
        await fetch("/api/withdrawals/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ challengeId, code }),
        })
      )
      setWithdrawalToken(result.withdrawalToken)
      setStep("verified")
      await createWithdrawal(result.withdrawalToken)
    })
  }

  async function retryCreate() {
    await run(() => createWithdrawal(withdrawalToken))
  }

  async function createWithdrawal(token: string) {
    if (netAmountMinor === null) throw new Error("Enter a valid amount")
    await readResponse(
      await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          netAmountMinor: netAmountMinor.toString(),
          network,
          withdrawalToken: token,
        }),
      })
    )
    setAmount("")
    setCode("")
    setWithdrawalToken("")
    setStep("details")
    setRequestOpen(false)
    router.refresh()
  }

  async function run(action: () => Promise<void>) {
    setPending(true)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong")
    } finally {
      setPending(false)
    }
  }

  function reset() {
    setStep("details")
    setChallengeId("")
    setCode("")
    setWithdrawalToken("")
    setError(null)
  }

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="font-heading text-2xl font-semibold">Withdraw funds</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Send available earnings to your registered Mobile Money number.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        {!requestOpen ? (
          <Card className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle>New request</CardTitle>
              <CardDescription>
                Request a payout of your available wallet earnings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-1.5 rounded-lg bg-muted/40 p-4 border text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Withdrawable Amount
                </span>
                <span className="text-xl font-bold">
                  {pesewasToGhs(withdrawableMinor)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Requests are processed after identity verification via a one-time SMS passcode. A transaction fee of GHS 1.00 applies.
              </p>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => setRequestOpen(true)}
                disabled={readOnly}
              >
                Request withdrawal
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>New request</CardTitle>
              <CardDescription>
                Every withdrawal is protected by SMS verification and reviewed by
                an Administrator.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error ? (
                <Alert className="mb-5" variant="destructive">
                  <AlertTitle>Request not completed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {step === "details" ? (
                <form id="withdrawal-details" onSubmit={requestOtp}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="withdrawal-amount">
                        Amount to receive (GHS)
                      </FieldLabel>
                      <Input
                        id="withdrawal-amount"
                        disabled={readOnly || pending}
                        inputMode="decimal"
                        min="10"
                        max="50000"
                        onChange={(event) => setAmount(event.target.value)}
                        placeholder="20.00"
                        required
                        step="0.01"
                        type="number"
                        value={amount}
                      />
                      <FieldDescription>
                        Minimum GHS 10.00. Available:{" "}
                        {pesewasToGhs(withdrawableMinor)}
                      </FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="withdrawal-network">
                        Mobile Money network
                      </FieldLabel>
                      <NativeSelect
                        className="w-full"
                        disabled={readOnly || pending}
                        id="withdrawal-network"
                        onChange={(event) => setNetwork(event.target.value)}
                        value={network}
                      >
                        <NativeSelectOption value="MTN">
                          MTN MoMo
                        </NativeSelectOption>
                        <NativeSelectOption value="TELECEL">
                          Telecel Cash
                        </NativeSelectOption>
                        <NativeSelectOption value="AIRTELTIGO">
                          AT Money
                        </NativeSelectOption>
                      </NativeSelect>
                      <FieldDescription>
                        Destination: {phoneMask}
                      </FieldDescription>
                    </Field>
                    <Separator />
                    <div className="flex flex-col gap-2 text-sm">
                      <SummaryRow
                        label="You receive"
                        value={money(
                          totalMinor === null ? null : totalMinor - 100n
                        )}
                      />
                      <SummaryRow label="Withdrawal fee" value="GHS 1.00" />
                      <SummaryRow
                        label="Total wallet hold"
                        value={money(totalMinor)}
                        strong
                        />
                    </div>
                  </FieldGroup>
                </form>
              ) : null}

              {step === "otp" ? (
                <form id="withdrawal-otp" onSubmit={verifyOtp}>
                  <FieldGroup>
                    <Field data-invalid={Boolean(error)}>
                      <FieldLabel htmlFor="withdrawal-otp-code">
                        Six-digit verification code
                      </FieldLabel>
                      <InputOTP
                        aria-invalid={Boolean(error)}
                        autoComplete="one-time-code"
                        id="withdrawal-otp-code"
                        inputMode="numeric"
                        maxLength={6}
                        onChange={setCode}
                        pattern="^[0-9]*$"
                        value={code}
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }, (_, index) => (
                            <InputOTPSlot index={index} key={index} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                      <div className="flex items-center justify-between mt-2.5">
                        <FieldDescription>
                          Sent to {phoneMask}. Expires in 5 minutes.
                        </FieldDescription>
                        <button
                          type="button"
                          onClick={resendOtp}
                          disabled={resendPending || pending}
                          className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                        >
                          {resendPending ? "Sending..." : "Resend code"}
                        </button>
                      </div>
                      {resendStatus ? (
                        <p className="text-xs font-medium text-emerald-600 mt-1">{resendStatus}</p>
                      ) : null}
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  </FieldGroup>
                </form>
              ) : null}

              {step === "verified" ? (
                <Alert>
                  <HugeiconsIcon icon={SecurityCheckIcon} />
                  <AlertTitle>Phone verified</AlertTitle>
                  <AlertDescription>
                    Verification succeeded. Retry the request while this secure
                    authorization is still valid.
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button
                disabled={pending}
                onClick={() => {
                  reset()
                  setRequestOpen(false)
                }}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              {step === "details" ? (
                <Button
                  className="flex-1"
                  disabled={!canRequest || pending}
                  form="withdrawal-details"
                  type="submit"
                >
                  {pending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      data-icon="inline-end"
                    />
                  )}
                  {pending ? "Sending code…" : "Verify and request"}
                </Button>
              ) : step === "otp" ? (
                <Button
                  className="flex-1"
                  disabled={code.length !== 6 || pending}
                  form="withdrawal-otp"
                  type="submit"
                >
                  {pending ? <Spinner data-icon="inline-start" /> : null}
                  {pending ? "Verifying…" : "Confirm withdrawal"}
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  disabled={pending}
                  onClick={retryCreate}
                  type="button"
                >
                  {pending ? <Spinner data-icon="inline-start" /> : null}
                  {pending ? "Submitting…" : "Retry request"}
                </Button>
              )}
            </CardFooter>
          </Card>
        )}

        <WithdrawalHistory withdrawals={withdrawals} />
      </div>
    </section>
  )
}

function WithdrawalHistory({
  withdrawals,
}: {
  withdrawals: AgentWithdrawal[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdrawal history</CardTitle>
        <CardDescription>
          Track reviews and provider processing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {withdrawals.length === 0 ? (
          <Empty className="min-h-64 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={MoneyReceiveCircleIcon} />
              </EmptyMedia>
              <EmptyTitle>No withdrawals yet</EmptyTitle>
              <EmptyDescription>
                Your requests will appear here after SMS verification.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requested</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.map((withdrawal) => (
                <TableRow key={withdrawal.id}>
                  <TableCell>{formatDate(withdrawal.requestedAt)}</TableCell>
                  <TableCell>
                    {withdrawal.destinationMask}
                    <span className="block text-xs text-muted-foreground">
                      {networkLabel(withdrawal.network)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge state={withdrawal.state} />
                    {withdrawal.decisionReason ? (
                      <span className="mt-1 block max-w-48 text-xs whitespace-normal text-muted-foreground">
                        {withdrawal.decisionReason}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {pesewasToGhs(withdrawal.netAmountMinor)}
                    <span className="block text-xs font-normal text-muted-foreground">
                      + {pesewasToGhs(withdrawal.feeAmountMinor)} fee
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ state }: { state: WithdrawalState }) {
  const terminalFailure = ["REJECTED", "CANCELLED", "FAILED"].includes(state)
  return (
    <Badge
      variant={
        terminalFailure
          ? "destructive"
          : state === "SUCCESS"
            ? "secondary"
            : "outline"
      }
    >
      {statusLabel(state)}
    </Badge>
  )
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  )
}

function parseGhs(value: string): bigint | null {
  const match = /^(\d{1,5})(?:\.(\d{0,2}))?$/.exec(value.trim())
  if (!match) return null
  return (
    BigInt(match[1] ?? "0") * 100n + BigInt((match[2] ?? "").padEnd(2, "0"))
  )
}

function money(value: bigint | null) {
  return value === null ? "—" : pesewasToGhs(value.toString())
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Accra",
  }).format(new Date(value))
}

function networkLabel(network: string) {
  return network === "MTN"
    ? "MTN MoMo"
    : network === "TELECEL"
      ? "Telecel Cash"
      : "AT Money"
}

function statusLabel(state: WithdrawalState) {
  const labels: Record<WithdrawalState, string> = {
    REQUESTED: "Awaiting review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
    AWAITING_MERCHANT_OTP: "Awaiting transfer approval",
    SUBMITTED: "Submitted",
    PENDING: "Processing",
    SUCCESS: "Paid",
    FAILED: "Failed",
    REVERSED: "Returned",
  }
  return labels[state]
}

async function readResponse<T = unknown>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as { message?: string }
  if (!response.ok)
    throw new Error(body.message ?? "The request could not be completed")
  return body as T
}
