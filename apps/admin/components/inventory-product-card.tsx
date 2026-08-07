"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
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
import { formatCount, formatMoney } from "@/lib/format"
import type { AdminViewerRole, ProductPricingPolicy } from "@/lib/pricing"

interface InventoryCounts {
  total: number
  available: number
  reserved: number
  sold: number
  quarantined: number
  void: number
  replaced: number
  refunded: number
}

interface InventoryProductCardProps {
  product: {
    id: string
    code: string
    name: string
    status: "ACTIVE" | "UNAVAILABLE"
    counts: InventoryCounts
  }
  policy: null | ProductPricingPolicy
  viewerRole: AdminViewerRole
}

export function InventoryProductCard({
  product,
  policy,
  viewerRole,
}: InventoryProductCardProps) {
  const isActive = product.status === "ACTIVE"

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
        <CardDescription>{product.code}</CardDescription>
        <CardAction>
          <Badge variant={isActive ? "secondary" : "outline"}>
            {isActive ? "Active" : "Unavailable"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-semibold tabular-nums">
            {formatCount(product.counts.available)}
          </p>
          <p className="text-sm text-muted-foreground">available now</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3 text-sm">
          <Count label="Reserved" value={product.counts.reserved} />
          <Count label="Sold" value={product.counts.sold} />
          <Count label="Quarantined" value={product.counts.quarantined} />
          <Count label="Void" value={product.counts.void} />
          <Count label="Replaced" value={product.counts.replaced} />
          <Count label="Refunded" value={product.counts.refunded} />
          <Count label="Total" value={product.counts.total} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Default pricing
            </p>
            <p className="text-sm font-medium tabular-nums">
              {policy
                ? `${formatMoney(policy.basePriceMinor)} – ${formatMoney(policy.maximumRetailPriceMinor)}`
                : "Not set"}
            </p>
          </div>
          {viewerRole === "ADMINISTRATOR" ? (
            <div className="flex flex-wrap items-center gap-2">
              <PricingDialog
                name={product.name}
                policy={policy}
                productId={product.id}
              />
              <AvailabilityDialog
                canPublish={Boolean(policy)}
                isActive={isActive}
                name={product.name}
                productId={product.id}
              />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{formatCount(value)}</span>
    </span>
  )
}

function PricingDialog({
  name,
  policy,
  productId,
}: {
  name: string
  policy: null | ProductPricingPolicy
  productId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    const form = new FormData(event.currentTarget)
    const basePriceMinor = Math.round(Number(form.get("basePrice")) * 100)
    const maximumRetailPriceMinor = Math.round(
      Number(form.get("maximumPrice")) * 100
    )
    if (
      !Number.isSafeInteger(basePriceMinor) ||
      !Number.isSafeInteger(maximumRetailPriceMinor) ||
      basePriceMinor < 0 ||
      maximumRetailPriceMinor < basePriceMinor
    ) {
      setMessage(
        "Enter a valid base and maximum price, with a maximum at least the base."
      )
      setPending(false)
      return
    }
    try {
      const response = await fetch("/api/pricing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          basePriceMinor,
          maximumRetailPriceMinor,
          effectiveFrom: new Date(
            String(form.get("effectiveFrom"))
          ).toISOString(),
          reason: String(form.get("reason") ?? "").trim(),
        }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        message?: string
        clampedPriceCount?: number
      }
      if (!response.ok) {
        throw new Error(result.message ?? "The change could not be saved")
      }
      setMessage(
        `Saved. ${result.clampedPriceCount ?? 0} active price${result.clampedPriceCount === 1 ? " was" : "s were"} adjusted.`
      )
      router.refresh()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The change could not be saved"
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
        variant="outline"
      >
        {policy ? "Update pricing" : "Set pricing"}
      </Button>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {policy ? "Update default pricing" : "Set default pricing"}
          </DialogTitle>
          <DialogDescription className="leading-6">
            Set the base price and highest buyer price for {name}. Active agent
            prices are adjusted automatically when the range changes.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <FieldGroup className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor={`base-${productId}`}>
                Base price (GHS)
              </FieldLabel>
              <Input
                defaultValue={policy ? String(policy.basePriceMinor / 100) : ""}
                id={`base-${productId}`}
                min="0"
                name="basePrice"
                step="0.01"
                type="number"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`maximum-${productId}`}>
                Maximum (GHS)
              </FieldLabel>
              <Input
                defaultValue={
                  policy ? String(policy.maximumRetailPriceMinor / 100) : ""
                }
                id={`maximum-${productId}`}
                min="0"
                name="maximumPrice"
                step="0.01"
                type="number"
              />
            </Field>
          </FieldGroup>
          <Field>
            <FieldLabel htmlFor={`effective-${productId}`}>
              Effective from
            </FieldLabel>
            <Input
              defaultValue={toDateTimeLocalValue(new Date())}
              id={`effective-${productId}`}
              name="effectiveFrom"
              type="datetime-local"
            />
            <FieldDescription>
              Use a future time to schedule this change.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`reason-${productId}`}>Reason</FieldLabel>
            <Input
              id={`reason-${productId}`}
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
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "Saving…" : "Save pricing"}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}

function AvailabilityDialog({
  canPublish,
  isActive,
  name,
  productId,
}: {
  canPublish: boolean
  isActive: boolean
  name: string
  productId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [reason, setReason] = useState("")

  async function changeStatus() {
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/products/${productId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: isActive ? "UNAVAILABLE" : "ACTIVE",
          reason: reason.trim(),
        }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        message?: string
      }
      if (!response.ok) {
        throw new Error(result.message ?? "The status could not be changed")
      }
      setMessage(isActive ? "Product made unavailable." : "Product published.")
      setReason("")
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
    <Dialog onOpenChange={setOpen} open={open}>
      <Button
        disabled={!isActive && !canPublish}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant={isActive ? "destructive" : "default"}
      >
        {isActive ? "Make unavailable" : "Publish"}
      </Button>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>
            {isActive
              ? "Make this product unavailable?"
              : "Publish this product?"}
          </DialogTitle>
          <DialogDescription className="leading-6">
            {isActive
              ? `${name} will stop accepting new checkout immediately. Existing records are unchanged.`
              : `${name} will be available for new checkout once published.`}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`availability-reason-${productId}`}>
              Reason
            </FieldLabel>
            <Input
              id={`availability-reason-${productId}`}
              minLength={5}
              onChange={(event) => setReason(event.target.value)}
              placeholder={
                isActive
                  ? "Why should new checkout stop?"
                  : "Why is this product ready to publish?"
              }
              required
              value={reason}
            />
            <FieldDescription>
              Product availability changes are retained in the audit trail.
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
              void changeStatus()
            }}
            type="button"
            variant={isActive ? "destructive" : "default"}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending
              ? "Saving…"
              : isActive
                ? "Make unavailable"
                : "Publish product"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
