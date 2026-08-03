"use client"

import { FormEvent, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
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

type Step = "reference" | "verification" | "vouchers"

interface RecoveryRequest {
  challengeId: string
  expiresAt: string
}

interface RecoveryVerification {
  recoveryToken: string
  expiresAt: string
}

interface RecoveredVoucher {
  position: number
  serialNumber: string
  pin: string
}

interface RecoveredPurchase {
  orderReference: string
  product: { code: string; name: string }
  vouchers: RecoveredVoucher[]
  usageReminder: string
}

export function BuyerRecoveryFlow() {
  const [step, setStep] = useState<Step>("reference")
  const [orderReference, setOrderReference] = useState("")
  const [challengeId, setChallengeId] = useState("")
  const [code, setCode] = useState("")
  const [purchase, setPurchase] = useState<RecoveredPurchase | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Phase 3 states for OTP resend
  const [resendPending, setResendPending] = useState(false)
  const [resendStatus, setResendStatus] = useState<string | null>(null)

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await submit(async () => {
      const response = await fetch("/api/buyer-recovery/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderReference: orderReference.trim() }),
      })
      const result = await readResponse<RecoveryRequest>(response)
      setChallengeId(result.challengeId)
      setStep("verification")
    })
  }

  async function resendCode() {
    setResendPending(true)
    setResendStatus(null)
    setError(null)
    try {
      const response = await fetch("/api/buyer-recovery/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderReference: orderReference.trim() }),
      })
      const result = await readResponse<RecoveryRequest>(response)
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

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await submit(async () => {
      const verificationResponse = await fetch("/api/buyer-recovery/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      })
      const verification =
        await readResponse<RecoveryVerification>(verificationResponse)
      const vouchersResponse = await fetch("/api/buyer-recovery/vouchers", {
        cache: "no-store",
        headers: { authorization: `Bearer ${verification.recoveryToken}` },
      })
      const result = await readResponse<RecoveredPurchase>(vouchersResponse)
      setPurchase(result)
      setStep("vouchers")
      setCode("")
    })
  }

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      window.setTimeout(() => setCopied(null), 1_500)
    } catch {
      setError("Your browser could not copy that value. Select it manually.")
    }
  }

  async function submit(action: () => Promise<void>) {
    setError(null)
    setIsSubmitting(true)
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  function startAgain() {
    setStep("reference")
    setOrderReference("")
    setChallengeId("")
    setCode("")
    setPurchase(null)
    setCopied(null)
    setError(null)
  }

  return (
    <Card className="shadow-[0_20px_70px_-35px_rgba(0,0,0,0.3)]">
      <CardHeader className="gap-2 px-6 pt-6 sm:px-7 sm:pt-7">
        <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <HugeiconsIcon
            icon={
              step === "vouchers" ? CheckmarkCircle02Icon : SecurityCheckIcon
            }
            strokeWidth={1.8}
          />
        </div>
        <CardTitle className="font-heading text-2xl font-semibold text-balance">
          {step === "reference"
            ? "Find your purchase"
            : step === "verification"
              ? "Check your delivery phone"
              : "Your checker details"}
        </CardTitle>
        <CardDescription className="leading-6 text-pretty">
          {step === "reference"
            ? "Use the order reference shown after checkout or in your delivery message."
            : step === "verification"
              ? "If this order can be recovered, a six-digit code has been sent to its original delivery phone."
              : "Keep these details private. They belong only to this recovered order."}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 sm:px-7">
        {error ? (
          <Alert className="mb-5" variant="destructive">
            <AlertTitle>We couldn&apos;t continue</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {step === "reference" ? (
          <form onSubmit={requestCode}>
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="recovery-reference">
                  Order reference
                </FieldLabel>
                <Input
                  id="recovery-reference"
                  autoCapitalize="none"
                  autoComplete="off"
                  className="font-mono"
                  name="orderReference"
                  onChange={(event) => setOrderReference(event.target.value)}
                  pattern="DRF-[A-Fa-f0-9]{24}"
                  placeholder="DRF-0123456789abcdef01234567"
                  required
                  spellCheck={false}
                  value={orderReference}
                />
                <FieldDescription>
                  Recovery is available after payment and checker allocation are
                  complete.
                </FieldDescription>
              </Field>
              <Field>
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <HugeiconsIcon
                      data-icon="inline-end"
                      icon={ArrowRight01Icon}
                    />
                  )}
                  {isSubmitting ? "Checking securely…" : "Continue securely"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        ) : null}

        {step === "verification" ? (
          <form onSubmit={verifyCode}>
            <FieldGroup>
              <Alert>
                <HugeiconsIcon icon={SecurityCheckIcon} />
                <AlertTitle>Private by design</AlertTitle>
                <AlertDescription>
                  For your safety, we don&apos;t confirm whether an order
                  reference exists or reveal any part of its delivery number.
                </AlertDescription>
              </Alert>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="recovery-code">
                  Verification code
                </FieldLabel>
                <InputOTP
                  id="recovery-code"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={setCode}
                  pattern="[0-9]*"
                  required
                  value={code}
                >
                  <InputOTPGroup>
                    {Array.from({ length: 6 }, (_, index) => (
                      <InputOTPSlot
                        className="size-10 sm:size-11"
                        index={index}
                        key={index}
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <div className="flex items-center justify-between mt-2.5">
                  <FieldDescription>
                    The code expires shortly and can only be used once.
                  </FieldDescription>
                  <button
                    type="button"
                    onClick={resendCode}
                    disabled={resendPending || isSubmitting}
                    className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    {resendPending ? "Sending..." : "Resend code"}
                  </button>
                </div>
                {resendStatus ? (
                  <p className="text-xs font-medium text-emerald-600 mt-1">{resendStatus}</p>
                ) : null}
              </Field>
              <Field>
                <Button
                  disabled={isSubmitting || code.length !== 6}
                  type="submit"
                >
                  {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
                  {isSubmitting ? "Recovering purchase…" : "Show my checkers"}
                </Button>
                <Button
                  disabled={isSubmitting}
                  onClick={startAgain}
                  type="button"
                  variant="ghost"
                >
                  <HugeiconsIcon
                    data-icon="inline-start"
                    icon={ArrowLeft01Icon}
                  />
                  Use another reference
                </Button>
              </Field>
            </FieldGroup>
          </form>
        ) : null}

        {step === "vouchers" && purchase ? (
          <div className="flex flex-col gap-5">
            <Alert>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} />
              <AlertTitle>{purchase.product.name}</AlertTitle>
              <AlertDescription>
                Order{" "}
                <span className="font-mono">{purchase.orderReference}</span>
              </AlertDescription>
            </Alert>
            <div className="flex flex-col gap-3">
              {purchase.vouchers.map((voucher) => (
                <div
                  className="rounded-xl border bg-muted/25 p-4"
                  key={voucher.position}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="font-medium">
                      Checker {voucher.position + 1}
                    </p>
                    <Badge variant="secondary">{purchase.product.code}</Badge>
                  </div>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <Secret
                      copied={copied === `serial-${voucher.position}`}
                      label="Serial number"
                      onCopy={() =>
                        void copy(
                          voucher.serialNumber,
                          `serial-${voucher.position}`
                        )
                      }
                      value={voucher.serialNumber}
                    />
                    <Secret
                      copied={copied === `pin-${voucher.position}`}
                      label="PIN"
                      onCopy={() =>
                        void copy(voucher.pin, `pin-${voucher.position}`)
                      }
                      value={voucher.pin}
                    />
                  </dl>
                </div>
              ))}
            </div>
            <Separator />
            <p className="text-sm leading-6 text-pretty text-muted-foreground">
              {purchase.usageReminder}
            </p>
          </div>
        ) : null}
      </CardContent>

      {step === "vouchers" ? (
        <CardFooter className="px-6 pb-6 sm:px-7 sm:pb-7">
          <Button onClick={startAgain} type="button" variant="outline">
            Recover another purchase
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}

function Secret({
  copied,
  label,
  onCopy,
  value,
}: {
  copied: boolean
  label: string
  onCopy: () => void
  value: string
}) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 flex items-center justify-between gap-2">
        <span className="min-w-0 font-mono text-base font-semibold break-all">
          {value}
        </span>
        <Button
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={onCopy}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {copied ? (
            <HugeiconsIcon icon={CheckmarkCircle02Icon} />
          ) : (
            <HugeiconsIcon icon={Copy01Icon} />
          )}
        </Button>
      </dd>
    </div>
  )
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
