"use client"

import { startAuthentication } from "@simplewebauthn/browser"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { readJson } from "@/lib/client-api"

type AuthenticationOptions = {
  ceremonyId: string
  options: Parameters<typeof startAuthentication>[0]["optionsJSON"]
}

export function PasskeyLoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function signIn() {
    setError(null)
    setIsSubmitting(true)
    try {
      const optionsResponse = await fetch(
        "/api/passkeys/authentication/options",
        { method: "POST" }
      )
      const options = (await readJson(optionsResponse)) as AuthenticationOptions
      const credential = await startAuthentication({
        optionsJSON: options.options,
      })
      const verificationResponse = await fetch(
        "/api/passkeys/authentication/verify",
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
      router.replace("/dashboard")
      router.refresh()
    } catch (cause) {
      setError(
        messageFor(cause, "Your passkey could not be verified. Try again.")
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-6 text-muted-foreground">
        Use the passkey registered to your Doraf internal account. This can be
        your device biometrics, screen lock, or security key.
      </p>
      {error ? (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <Button
        className="w-full"
        disabled={isSubmitting}
        onClick={signIn}
        type="button"
      >
        {isSubmitting ? "Verifying passkey…" : "Continue with passkey"}
      </Button>
    </div>
  )
}

function messageFor(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback
}
