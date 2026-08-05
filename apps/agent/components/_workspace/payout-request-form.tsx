"use client"

import { FormEvent, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon } from "@hugeicons/core-free-icons"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { Spinner } from "@workspace/ui/components/spinner"
import { pesewasToGhs } from "@workspace/ui/lib/format"
import { type Step } from "../payout-panel"
import { type PayoutDestinationData } from "./payout-destination-form"

export function PayoutRequestForm({
  phoneMask,
  destination,
  withdrawableMinor,
  readOnly,
  onRequestCreated,
  onCancel,
  onOpenDestinationSetup,
}: {
  phoneMask: string
  destination: PayoutDestinationData | null
  withdrawableMinor: string
  readOnly: boolean
  onRequestCreated: () => void
  onCancel: () => void
  onOpenDestinationSetup: () => void
}) {
  const [step, setStep] = useState<Step>("details")
  const [amount, setAmount] = useState("")
  const [challengeId, setChallengeId] = useState("")
  const [code, setCode] = useState("")
  const [payoutToken, setPayoutToken] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [resendPending, setResendPending] = useState(false)
  const [resendStatus, setResendStatus] = useState<string | null>(null)

  const netAmountMinor = parseGhs(amount)
  const totalMinor = netAmountMinor === null ? null : netAmountMinor + 100n
  const canRequest =
    !readOnly &&
    Boolean(destination) &&
    totalMinor !== null &&
    netAmountMinor !== null &&
    netAmountMinor >= 1_000n &&
    netAmountMinor <= 5_000_000n &&
    totalMinor <= BigInt(withdrawableMinor)

  if (!destination) {
    return (
      <div className="space-y-4">
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-5 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="font-bold text-amber-900 dark:text-amber-200">
            Payout Destination Required
          </AlertTitle>
          <AlertDescription className="mt-1">
            You must set up and validate your Mobile Money account with Paystack before requesting payouts.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end gap-3 border-t pt-4">
          <Button onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
          <Button onClick={onOpenDestinationSetup} type="button">
            Set Up Destination
          </Button>
        </div>
      </div>
    )
  }

  async function requestOtp(event: FormEvent) {
    event.preventDefault()
    if (!canRequest || netAmountMinor === null) return

    await run(async () => {
      const response = await fetch("/api/payouts/otp", {
        method: "POST",
      })
      const body = await readResponse<{ challengeId: string }>(response)
      setChallengeId(body.challengeId)
      setStep("otp")
    })
  }

  async function resendOtp() {
    setResendPending(true)
    setResendStatus(null)
    try {
      const response = await fetch("/api/payouts/otp", {
        method: "POST",
      })
      await readResponse(response)
      setResendStatus("Code resent successfully")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to resend code")
    } finally {
      setResendPending(false)
    }
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault()
    if (!canRequest || netAmountMinor === null) return

    await run(async () => {
      const response = await fetch("/api/payouts/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      })
      const body = await readResponse<{ withdrawalToken: string }>(response)
      setPayoutToken(body.withdrawalToken)
      setStep("verified")
      await createPayout(body.withdrawalToken)
    })
  }

  async function retryCreate() {
    if (!payoutToken) return
    await run(() => createPayout(payoutToken))
  }

  async function createPayout(token: string) {
    if (netAmountMinor === null || !destination) return
    await run(async () => {
      const response = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          netAmountMinor: netAmountMinor.toString(),
          network: destination.network,
          withdrawalToken: token,
        }),
      })
      await readResponse(response)
    })
    setAmount("")
    setCode("")
    setPayoutToken("")
    setStep("details")
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
    setPayoutToken("")
    setError(null)
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert className="mb-4" variant="destructive">
          <AlertTitle>Request not completed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        {step === "details" ? (
          <form id="payout-details" onSubmit={requestOtp}>
            <FieldGroup>
              <Field>
                <div className="flex justify-between items-baseline mb-1.5">
                  <FieldLabel htmlFor="payout-amount">
                    Amount to receive (GHS)
                  </FieldLabel>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Available: {pesewasToGhs(withdrawableMinor)}
                  </span>
                </div>
                <Input
                  id="payout-amount"
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
                  The minimum payout is GHS 10.00. The maximum is GHS 50,000.00.
                </FieldDescription>
              </Field>
              
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-1.5">
                <div className="font-semibold text-foreground">Target Destination Account:</div>
                <div className="text-sm font-bold text-foreground">
                  {destination.accountName}
                </div>
                <div className="text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-foreground">{destination.network}</span>
                  <span>•</span>
                  <span className="font-mono text-foreground">{destination.phoneMask}</span>
                </div>
              </div>
            </FieldGroup>
          </form>
        ) : null}

        {step === "otp" ? (
          <form id="payout-verification" onSubmit={verifyOtp}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="payout-code">
                  Verification code
                </FieldLabel>
                <InputOTP
                  autoComplete="one-time-code"
                  id="payout-code"
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
          <div className="flex flex-col items-center justify-center py-8 text-center">
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
      </div>

      {step !== "verified" ? (
        <div className="flex flex-col gap-3 border-t pt-4">
          {step === "details" ? (
            <>
              <FieldSet className="w-full text-xs">
                <FieldLegend className="sr-only">
                  Transaction breakdown
                </FieldLegend>
                <DestDetail
                  label="Target account owner"
                  value={destination.accountName}
                  strong
                />
                <DestDetail
                  label="Gross payout amount"
                  value={money(netAmountMinor)}
                />
                <DestDetail
                  label="Verification fee"
                  value={money(100n)}
                />
                <DestDetail
                  label="Total earnings debit"
                  strong
                  value={money(totalMinor)}
                />
              </FieldSet>
              <div className="flex w-full gap-3 mt-2">
                <Button
                  className="flex-1"
                  onClick={onCancel}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={pending || !canRequest}
                  form="payout-details"
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
                form="payout-verification"
                type="submit"
              >
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {pending ? "Verifying…" : "Confirm & request"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
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
