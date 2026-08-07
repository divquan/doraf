"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  SecurityCheckIcon,
  SmartPhone01Icon,
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
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { Spinner } from "@workspace/ui/components/spinner"

type Mode = "login" | "register"
type Step = "phone" | "otp" | "profile"

interface OtpResponse {
  challengeId: string
  expiresAt: string
  phoneMask: string
}

export function AgentAuthFlow({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>("phone")
  const [phone, setPhone] = useState("")
  const [phoneMask, setPhoneMask] = useState("")
  const [challengeId, setChallengeId] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Phase 3 states for OTP resend
  const [resendPending, setResendPending] = useState(false)
  const [resendStatus, setResendStatus] = useState<string | null>(null)

  const isRegistration = mode === "register"

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await submit(async () => {
      const response = await fetch(
        `/api/agent-auth/${isRegistration ? "registration" : "login"}/otp`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone }),
        }
      )
      const result = await readResponse<OtpResponse>(response)
      setChallengeId(result.challengeId)
      setPhoneMask(result.phoneMask)
      setStep("otp")
    })
  }

  async function resendCode() {
    setResendPending(true)
    setResendStatus(null)
    setError(null)
    try {
      const response = await fetch(
        `/api/agent-auth/${isRegistration ? "registration" : "login"}/otp`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone }),
        }
      )
      const result = await readResponse<OtpResponse>(response)
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
      const response = await fetch(
        `/api/agent-auth/${isRegistration ? "registration" : "login"}/verify`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ challengeId, code }),
        }
      )
      await readResponse(response)
      if (isRegistration) {
        setStep("profile")
        return
      }
      router.push("/dashboard")
      router.refresh()
    })
  }

  async function completeRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await submit(async () => {
      const response = await fetch("/api/agent-auth/registration/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: String(form.get("name") ?? "").trim() }),
      })
      await readResponse(response)
      router.push("/dashboard")
      router.refresh()
    })
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

  function returnToPhone() {
    setStep("phone")
    setCode("")
    setError(null)
  }

  const copy = authCopy(mode, step)

  return (
    <Card className="w-full max-w-md shadow-[0_20px_70px_-35px_rgba(0,0,0,0.3)]">
      <CardHeader className="gap-2 px-6 pt-6 sm:px-7 sm:pt-7">
        <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <HugeiconsIcon
            icon={step === "phone" ? SmartPhone01Icon : SecurityCheckIcon}
            strokeWidth={1.8}
          />
        </div>
        <CardTitle className="font-heading text-2xl font-semibold text-balance">
          {copy.title}
        </CardTitle>
        <CardDescription className="leading-6 text-pretty">
          {copy.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 sm:px-7">
        {error ? (
          <Alert className="mb-5" variant="destructive">
            <AlertTitle>We couldn&apos;t continue</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {step === "phone" ? (
          <form onSubmit={requestCode}>
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor={`${mode}-phone`}>Phone number</FieldLabel>
                <Input
                  id={`${mode}-phone`}
                  autoComplete="tel"
                  inputMode="tel"
                  name="phone"
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="024 123 4567"
                  required
                  value={phone}
                />
                <FieldDescription>
                  We&apos;ll text a one-time code to this number.
                </FieldDescription>
              </Field>
              <Field>
                <Button className="h-10" disabled={isSubmitting} type="submit">
                  {isSubmitting ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      data-icon="inline-end"
                    />
                  )}
                  {isSubmitting ? "Sending code…" : "Send code"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        ) : null}

        {step === "otp" ? (
          <form onSubmit={verifyCode}>
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor={`${mode}-otp`}>
                  Six-digit verification code
                </FieldLabel>
                <InputOTP
                  aria-invalid={Boolean(error)}
                  autoComplete="one-time-code"
                  id={`${mode}-otp`}
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
                  className="h-10"
                  disabled={isSubmitting || code.length !== 6}
                  type="submit"
                >
                  {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
                  {isSubmitting ? "Verifying…" : "Verify code"}
                </Button>
                <Button onClick={returnToPhone} type="button" variant="ghost">
                  <HugeiconsIcon
                    icon={ArrowLeft01Icon}
                    data-icon="inline-start"
                  />
                  Use another number
                </Button>
              </Field>
            </FieldGroup>
          </form>
        ) : null}

        {step === "profile" ? (
          <form onSubmit={completeRegistration}>
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="agent-name">Your full name</FieldLabel>
                <Input
                  autoComplete="name"
                  id="agent-name"
                  maxLength={120}
                  minLength={2}
                  name="name"
                  placeholder="Ama Mensah"
                  required
                />
                <FieldDescription>
                  This identifies you in your portal and buyer-facing sales
                  flow.
                </FieldDescription>
              </Field>
              <Field>
                <Button className="h-10" disabled={isSubmitting} type="submit">
                  {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
                  {isSubmitting ? "Creating account…" : "Create agent account"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        ) : null}
      </CardContent>
      <CardFooter className="justify-center px-6 py-4 text-sm text-muted-foreground">
        {isRegistration ? (
          <p className="text-center text-pretty">
            Already an agent?{" "}
            <Link
              className="font-medium text-foreground hover:underline"
              href="/login"
            >
              Sign in
            </Link>
          </p>
        ) : (
          <p className="text-center text-pretty">
            New to Doraf?{" "}
            <Link
              className="font-medium text-foreground hover:underline"
              href="/register"
            >
              Create an agent account
            </Link>
          </p>
        )}
      </CardFooter>
    </Card>
  )
}

function authCopy(mode: Mode, step: Step) {
  if (step === "otp") {
    return {
      title: "Enter the code",
      description: "Enter the 6-digit code sent to your phone.",
    }
  }
  if (step === "profile") {
    return {
      title: "What&apos;s your name?",
      description:
        "This is shown to your buyers and on your sales channels.",
    }
  }
  return mode === "register"
    ? {
        title: "Create your account",
        description: "Enter your phone number to get started. No password needed.",
      }
    : {
        title: "Welcome back",
        description: "Enter your phone number and we&apos;ll send you a one-time login code.",
      }
}

async function readResponse<T = unknown>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String(body.message)
        : "The request could not be completed"
    throw new Error(message)
  }
  return body as T
}
