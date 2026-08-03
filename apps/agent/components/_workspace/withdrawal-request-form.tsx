"use client"

import { FormEvent, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  MoneyReceiveCircleIcon,
  SecurityCheckIcon,
} from "@hugeicons/core-free-icons"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
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
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
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
import { Spinner } from "@workspace/ui/components/spinner"
import { pesewasToGhs } from "@workspace/ui/lib/format"
import { type Step } from "../withdrawal-panel"

export function WithdrawalRequestForm({
  phoneMask,
  withdrawableMinor,
  readOnly,
  onRequestCreated,
}: {
  phoneMask: string
  withdrawableMinor: string
  readOnly: boolean
  onRequestCreated: () => void
}) {
  const [step, setStep] = useState<Step>("details")
  const [amount, setAmount] = useState("")
  const [network, setNetwork] = useState("MTN")
  const [challengeId, setChallengeId] = useState("")
  const [code, setCode] = useState("")
  const [withdrawalToken, setWithdrawalToken] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
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
    onRequestCreated()
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
    <>
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
                      inputMode="decimal"
                      min="10.00"
                      name="amount"
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="10.00"
                      required
                      step="0.01"
                      type="number"
                      value={amount}
                    />
                    <FieldDescription>
                      The minimum withdrawal is GHS 10.00. The maximum is GHS
                      50,000.00.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="withdrawal-network">
                      Mobile Money network
                    </FieldLabel>
                    <NativeSelect
                      id="withdrawal-network"
                      name="network"
                      onChange={(event) => setNetwork(event.target.value)}
                      value={network}
                    >
                      <NativeSelectOption value="MTN">
                        MTN Mobile Money
                      </NativeSelectOption>
                      <NativeSelectOption value="TELECEL">
                        Telecel Cash
                      </NativeSelectOption>
                      <NativeSelectOption value="AIRTELTIGO">
                        AT Money
                      </NativeSelectOption>
                    </NativeSelect>
                  </Field>
                </FieldGroup>
              </form>
            ) : null}

            {step === "otp" ? (
              <form id="withdrawal-verification" onSubmit={verifyOtp}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="withdrawal-code">
                      Verification code
                    </FieldLabel>
                    <InputOTP
                      autoComplete="one-time-code"
                      id="withdrawal-code"
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
                  </Field>
                </FieldGroup>
              </form>
            ) : null}

            {step === "verified" ? (
              <div className="flex flex-col items-center justify-center py-5 text-center">
                <Spinner className="size-10" />
                <p className="mt-4 text-sm font-medium text-foreground">
                  Submitting payout request…
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Confirming with the payment provider. Do not close this panel.
                </p>
                {error ? (
                  <Button className="mt-6" onClick={retryCreate} type="button">
                    Retry submission
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
          {step !== "verified" ? (
            <CardFooter className="flex-col gap-3 border-t bg-muted/15 pt-4">
              {step === "details" ? (
                <>
                  <FieldSet className="w-full text-xs">
                    <FieldLegend className="sr-only">
                      Transaction breakdown
                    </FieldLegend>
                    <DestDetail
                      label="Gross payout amount"
                      value={money(netAmountMinor)}
                    />
                    <DestDetail
                      label="Verification fee"
                      value={money(100n)}
                    />
                    <DestDetail
                      label="Total wallet debit"
                      strong
                      value={money(totalMinor)}
                    />
                  </FieldSet>
                  <div className="flex w-full gap-3 mt-2">
                    <Button
                      className="flex-1"
                      onClick={() => setRequestOpen(false)}
                      type="button"
                      variant="outline"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={pending || !canRequest}
                      form="withdrawal-details"
                      type="submit"
                    >
                      {pending ? <Spinner data-icon="inline-start" /> : null}
                      {pending ? "Requesting…" : "Send SMS code"}
                    </Button>
                  </div>
                </>
              ) : null}

              {step === "otp" ? (
                <div className="flex w-full gap-3">
                  <Button
                    className="flex-1"
                    onClick={reset}
                    type="button"
                    variant="outline"
                  >
                    Change request
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={pending || code.length !== 6}
                    form="withdrawal-verification"
                    type="submit"
                  >
                    {pending ? <Spinner data-icon="inline-start" /> : null}
                    {pending ? "Verifying…" : "Confirm & request"}
                  </Button>
                </div>
              ) : null}
            </CardFooter>
          ) : null}
        </Card>
      )}
    </>
  )
}

function DestDetail({
  label,
  value,
  strong,
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

async function readResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as {
    message?: string | string[]
  }
  if (!response.ok) {
    const message = body.message
    throw new Error(
      Array.isArray(message)
        ? message.join(". ")
        : (message ?? "The request could not be completed")
    )
  }
  return body as T
}
