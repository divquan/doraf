"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
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
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { formatDateTime, formatMoney } from "@/lib/format"
import type {
  AgentPricingOverride,
  AgentPricingOverridesData,
} from "@/lib/pricing"

export function AgentPricingOverrides({
  agentId,
  data,
}: {
  agentId: string
  data: AgentPricingOverridesData
}) {
  const [editor, setEditor] = useState<null | {
    initial: AgentPricingOverride | null
  }>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent price overrides</CardTitle>
        <CardDescription className="leading-6">
          Active per-product price exceptions for this agent. Products without
          an override inherit the default checker range. Every change is audited
          and existing agent prices are adjusted automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.overrides.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">
              No active price overrides. This agent currently inherits the
              default checker ranges.
            </p>
            <AddOverrideButton onOpen={() => setEditor({ initial: null })} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <AddOverrideButton onOpen={() => setEditor({ initial: null })} />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Price range</TableHead>
                  <TableHead>Effective from</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.overrides.map((override) => (
                  <TableRow key={override.id}>
                    <TableCell>
                      <p className="font-medium">{override.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {override.productCode}
                      </p>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatRange(
                        override.basePriceMinor,
                        override.maximumRetailPriceMinor
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDateTime(override.effectiveFrom)}
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-52 truncate">
                        {override.reason}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          onClick={() => setEditor({ initial: override })}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Edit
                        </Button>
                        <RemoveOverrideDialog
                          agentId={agentId}
                          override={override}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {editor ? (
          <OverrideEditorDialog
            agentId={agentId}
            initial={editor.initial}
            onClose={() => setEditor(null)}
            products={data.products}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function AddOverrideButton({ onOpen }: { onOpen: () => void }) {
  return (
    <Button onClick={onOpen} size="sm" type="button">
      Add override
    </Button>
  )
}

function OverrideEditorDialog({
  agentId,
  initial,
  onClose,
  products,
}: {
  agentId: string
  initial: AgentPricingOverride | null
  onClose: () => void
  products: AgentPricingOverridesData["products"]
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    const form = new FormData(event.currentTarget)
    const amount = (name: string) => {
      const value = String(form.get(name) ?? "").trim()
      return value ? Math.round(Number(value) * 100) : undefined
    }
    const body = {
      agentId,
      productId: String(form.get("productId")),
      basePriceMinor: amount("basePrice"),
      maximumRetailPriceMinor: amount("maximumPrice"),
      effectiveFrom: new Date(String(form.get("effectiveFrom"))).toISOString(),
      reason: String(form.get("reason") ?? "").trim(),
    }
    if (
      body.basePriceMinor === undefined &&
      body.maximumRetailPriceMinor === undefined
    ) {
      setMessage("Set at least one side of the range.")
      setPending(false)
      return
    }
    try {
      const response = await fetch("/api/pricing/overrides", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = (await response.json().catch(() => ({}))) as {
        message?: string
        clampedPriceCount?: number
      }
      if (!response.ok) {
        throw new Error(result.message ?? "The override could not be saved")
      }
      setMessage(
        `Saved. ${result.clampedPriceCount ?? 0} active price${result.clampedPriceCount === 1 ? " was" : "s were"} adjusted.`
      )
      onClose()
      router.refresh()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The override could not be saved"
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog onOpenChange={(open) => (open ? undefined : onClose())} open>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit agent price override" : "Add agent price override"}
          </DialogTitle>
          <DialogDescription className="leading-6">
            {initial
              ? "Save a new range for this product. The previous override is closed when the new one takes effect."
              : "Override either side of the permitted range for one product. Leave a price blank to inherit the product default."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <Field>
            <FieldLabel htmlFor="override-product">Checker product</FieldLabel>
            <NativeSelect
              className="w-full"
              defaultValue={initial?.productId ?? undefined}
              disabled={Boolean(initial)}
              id="override-product"
              name="productId"
              required
            >
              {products.map((product) => (
                <NativeSelectOption
                  disabled={!product.policy}
                  key={product.id}
                  value={product.id}
                >
                  {product.name}
                  {product.policy ? "" : " (pricing not configured)"}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>
              Products without an active default range cannot be overridden yet.
            </FieldDescription>
          </Field>
          <FieldGroup className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="override-base">Base price (GHS)</FieldLabel>
              <Input
                defaultValue={
                  initial?.basePriceMinor === null ||
                  initial?.basePriceMinor === undefined
                    ? ""
                    : String(initial.basePriceMinor / 100)
                }
                id="override-base"
                min="0"
                name="basePrice"
                step="0.01"
                type="number"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="override-max">Maximum (GHS)</FieldLabel>
              <Input
                defaultValue={
                  initial?.maximumRetailPriceMinor === null ||
                  initial?.maximumRetailPriceMinor === undefined
                    ? ""
                    : String(initial.maximumRetailPriceMinor / 100)
                }
                id="override-max"
                min="0"
                name="maximumPrice"
                step="0.01"
                type="number"
              />
            </Field>
          </FieldGroup>
          <Field>
            <FieldLabel htmlFor="override-effective">Effective from</FieldLabel>
            <Input
              defaultValue={toDateTimeLocalValue(new Date())}
              id="override-effective"
              name="effectiveFrom"
              type="datetime-local"
            />
            <FieldDescription>
              Use a future time to schedule this override.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="override-reason">Reason</FieldLabel>
            <Input
              defaultValue={initial?.reason ?? ""}
              id="override-reason"
              minLength={5}
              name="reason"
              placeholder="Why is this range changing?"
              required
            />
          </Field>
          {message ? (
            <p
              className="rounded-md border bg-muted/30 p-3 text-sm"
              role="status"
            >
              {message}
            </p>
          ) : null}
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "Saving…" : "Save override"}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}

function RemoveOverrideDialog({
  agentId,
  override,
}: {
  agentId: string
  override: AgentPricingOverride
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [reason, setReason] = useState("")

  async function remove() {
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch(
        `/api/agents/${agentId}/pricing-overrides/${override.id}/close`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        }
      )
      const result = (await response.json().catch(() => ({}))) as {
        message?: string
        clampedPriceCount?: number
      }
      if (!response.ok) {
        throw new Error(result.message ?? "The override could not be removed")
      }
      setMessage(
        `Removed. ${result.clampedPriceCount ?? 0} active price${result.clampedPriceCount === 1 ? " was" : "s were"} adjusted.`
      )
      setReason("")
      router.refresh()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The override could not be removed"
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="destructive"
      >
        Remove
      </Button>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Remove this price override?</DialogTitle>
          <DialogDescription className="leading-6">
            {override.productName} will fall back to the default checker range.
            The agent&apos;s active retail price is adjusted if it sits outside
            the default range.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`remove-reason-${override.id}`}>
              Reason
            </FieldLabel>
            <Input
              id={`remove-reason-${override.id}`}
              minLength={5}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is this override being removed?"
              required
              value={reason}
            />
            <FieldDescription>
              This reason is retained in the sensitive-action audit record.
            </FieldDescription>
          </Field>
        </FieldGroup>
        {message ? (
          <p
            className="rounded-md border bg-muted/30 p-3 text-sm"
            role="status"
          >
            {message}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={pending || reason.trim().length < 5}
            onClick={() => {
              setOpen(false)
              void remove()
            }}
            type="button"
            variant="destructive"
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? "Removing…" : "Remove override"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}

function formatRange(base: number | null, maximum: number | null): string {
  return `${base === null ? "Inherit" : formatMoney(base)} – ${
    maximum === null ? "Inherit" : formatMoney(maximum)
  }`
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
