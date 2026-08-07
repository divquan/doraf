"use client"

import Link from "next/link"
import { useState } from "react"
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
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"

interface AgentSummary {
  id: string
  name: string
  phoneMask: string
  status: "ACTIVE" | "SUSPENDED"
}

interface RowMessage {
  text: string
  tone: "success" | "error"
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
      <CardContent>
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No agent accounts have been created yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <AgentRow agent={agent} key={agent.id} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function AgentRow({ agent }: { agent: AgentSummary }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<RowMessage | null>(null)
  const [reason, setReason] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const isActive = agent.status === "ACTIVE"

  async function changeStatus() {
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/agents/${agent.id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: isActive ? "SUSPENDED" : "ACTIVE",
          reason: reason.trim(),
        }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        message?: string
      }
      if (!response.ok) {
        throw new Error(result.message ?? "The status could not be changed")
      }
      setMessage({
        text: isActive ? "Agent suspended." : "Agent restored.",
        tone: "success",
      })
      setReason("")
      router.refresh()
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "The status could not be changed",
        tone: "error",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{agent.name}</p>
        <p className="text-xs text-muted-foreground">{agent.phoneMask}</p>
      </TableCell>
      <TableCell>
        <Badge variant={isActive ? "secondary" : "destructive"}>
          {isActive ? "Active" : "Suspended"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center justify-end gap-2">
            <Button
              render={<Link href={`/agents/${agent.id}`} />}
              size="sm"
              type="button"
              variant="outline"
            >
              View
            </Button>
            <Button
              disabled={pending}
              onClick={() => setConfirmOpen(true)}
              size="sm"
              type="button"
              variant={isActive ? "destructive" : "default"}
            >
              {isActive ? "Suspend agent" : "Restore agent"}
            </Button>
            {pending ? <Spinner className="size-4" /> : null}
          </div>
          {message ? (
            <p
              className={cn(
                "max-w-56 text-right text-xs",
                message.tone === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
              role="status"
            >
              {message.text}
            </p>
          ) : null}
        </div>
      </TableCell>
      <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>
              {isActive ? "Suspend this agent?" : "Restore this agent?"}
            </DialogTitle>
            <DialogDescription>
              {isActive
                ? "The agent will not be able to start new sales until access is restored. Existing records are preserved."
                : "The agent will be able to start new sales again after review."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`reason-${agent.id}`}>Reason</FieldLabel>
              <Input
                id={`reason-${agent.id}`}
                minLength={5}
                onChange={(event) => setReason(event.target.value)}
                placeholder={
                  isActive
                    ? "Why is this account being suspended?"
                    : "Why is this account being restored?"
                }
                value={reason}
              />
              <FieldDescription>
                This reason is retained in the sensitive-action audit record.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              onClick={() => setConfirmOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={reason.trim().length < 5}
              onClick={() => {
                setConfirmOpen(false)
                void changeStatus()
              }}
              type="button"
              variant={isActive ? "destructive" : "default"}
            >
              {isActive ? "Suspend agent" : "Restore agent"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </TableRow>
  )
}
