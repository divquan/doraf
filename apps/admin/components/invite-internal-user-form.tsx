"use client"

import { FormEvent, useState } from "react"

import { Button } from "@workspace/ui/components/button"

type Invitation = { enrollmentToken: string; enrollmentExpiresAt: string }

export function InviteInternalUserForm() {
  const [error, setError] = useState<string | null>(null)
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setInvitation(null)
    setIsSubmitting(true)
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    try {
      const response = await fetch("/api/internal-users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: String(form.get("displayName") ?? "").trim(),
          role: String(form.get("role") ?? "SUPPORT"),
          reason: String(form.get("reason") ?? "").trim(),
        }),
      })
      const body: unknown = await response.json().catch(() => ({}))
      if (
        !response.ok ||
        typeof body !== "object" ||
        body === null ||
        !("enrollmentToken" in body) ||
        !("enrollmentExpiresAt" in body)
      ) {
        throw new Error(
          typeof body === "object" && body !== null && "message" in body
            ? String(body.message)
            : "Invitation could not be created"
        )
      }
      setInvitation({
        enrollmentToken: String(body.enrollmentToken),
        enrollmentExpiresAt: String(body.enrollmentExpiresAt),
      })
      formElement.reset()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Invitation could not be created"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="flex max-w-xl flex-col gap-4" onSubmit={invite}>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="displayName">
          Operator name
        </label>
        <input
          className="h-10 rounded-md border bg-background px-3 text-sm"
          id="displayName"
          maxLength={120}
          name="displayName"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="role">
          Role
        </label>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          defaultValue="SUPPORT"
          id="role"
          name="role"
        >
          <option value="SUPPORT">Support</option>
          <option value="ADMINISTRATOR">Administrator</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="reason">
          Reason
        </label>
        <textarea
          className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
          id="reason"
          maxLength={500}
          minLength={5}
          name="reason"
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
      {invitation ? (
        <div className="flex flex-col gap-2 rounded-md border p-4 text-sm">
          <p className="font-medium">
            Share this token once through an approved secure channel.
          </p>
          <code className="rounded bg-muted p-3 break-all">
            {invitation.enrollmentToken}
          </code>
          <p className="text-muted-foreground">
            Expires {new Date(invitation.enrollmentExpiresAt).toLocaleString()}.
          </p>
        </div>
      ) : null}
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creating invitation…" : "Create invitation"}
      </Button>
    </form>
  )
}
