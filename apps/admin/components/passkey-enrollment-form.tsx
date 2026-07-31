"use client"

import { startRegistration } from "@simplewebauthn/browser"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"

import { Button } from "@workspace/ui/components/button"

type RegistrationOptions = {
  ceremonyId: string
  options: Parameters<typeof startRegistration>[0]["optionsJSON"]
}

export function PasskeyEnrollmentForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = new FormData(event.currentTarget)
    const enrollmentToken = String(form.get("enrollmentToken") ?? "").trim()
    const credentialName = String(form.get("credentialName") ?? "").trim()
    if (!enrollmentToken || !credentialName) {
      setError("Enter the enrollment token and a name for this passkey.")
      return
    }

    setIsSubmitting(true)
    try {
      const optionsResponse = await fetch(
        "/api/passkeys/registration/options",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enrollmentToken, credentialName }),
        }
      )
      const options = (await readJson(optionsResponse)) as RegistrationOptions
      const credential = await startRegistration({
        optionsJSON: options.options,
      })
      const verificationResponse = await fetch(
        "/api/passkeys/registration/verify",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ceremonyId: options.ceremonyId,
            response: credential,
          }),
        }
      )
      await readJson(verificationResponse)
      router.replace("/login?enrolled=1")
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Your passkey could not be enrolled. Try again."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={enroll}>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="enrollmentToken">
          Enrollment token
        </label>
        <input
          autoComplete="one-time-code"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          id="enrollmentToken"
          name="enrollmentToken"
          required
        />
        <p className="text-sm text-muted-foreground">
          Paste the short-lived token provided by your administrator.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="credentialName">
          Passkey name
        </label>
        <input
          className="h-10 rounded-md border bg-background px-3 text-sm"
          defaultValue="This device"
          id="credentialName"
          maxLength={80}
          name="credentialName"
          required
        />
      </div>
      {error ? (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creating passkey…" : "Create passkey"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already enrolled?{" "}
        <Link className="text-foreground underline" href="/login">
          Sign in
        </Link>
      </p>
    </form>
  )
}

async function readJson(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String(body.message)
        : "The request could not be completed"
    throw new Error(message)
  }
  return body
}
