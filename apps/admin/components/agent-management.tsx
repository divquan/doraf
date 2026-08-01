"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
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
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"

interface AgentSummary {
  id: string
  name: string
  phoneMask: string
  status: "ACTIVE" | "SUSPENDED"
}

export function AgentManagement({ agents }: { agents: AgentSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent access</CardTitle>
        <CardDescription className="leading-6">
          Suspend an agent to stop new sales, or restore access after review.
          Every change requires a reason and is written to the audit trail.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {agents.length ? (
          agents.map((agent) => (
            <AgentStatusControl agent={agent} key={agent.id} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No agent accounts have been created yet.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function AgentStatusControl({ agent }: { agent: AgentSummary }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const isActive = agent.status === "ACTIVE"

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setPending(true)
    setMessage(null)
    const form = new FormData(formElement)
    try {
      const response = await fetch(`/api/agents/${agent.id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: isActive ? "SUSPENDED" : "ACTIVE",
          reason: String(form.get("reason") ?? "").trim(),
        }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        message?: string
      }
      if (!response.ok) {
        throw new Error(result.message ?? "The status could not be changed")
      }
      setMessage(isActive ? "Agent suspended." : "Agent restored.")
      formElement.reset()
      router.refresh()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The status could not be changed"
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border p-4"
      onSubmit={submit}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{agent.name}</p>
          <p className="text-sm text-muted-foreground">{agent.phoneMask}</p>
        </div>
        <Badge variant={isActive ? "secondary" : "destructive"}>
          {isActive ? "Active" : "Suspended"}
        </Badge>
      </div>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`reason-${agent.id}`}>Reason</FieldLabel>
          <Input
            id={`reason-${agent.id}`}
            minLength={5}
            name="reason"
            placeholder={
              isActive
                ? "Why is this account being suspended?"
                : "Why is this account being restored?"
            }
            required
          />
          <FieldDescription>
            This reason is retained in the sensitive-action audit record.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={pending}
          type="submit"
          variant={isActive ? "destructive" : "default"}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? "Saving…" : isActive ? "Suspend agent" : "Restore agent"}
        </Button>
        {message ? (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </form>
  )
}
