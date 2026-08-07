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

interface ProductSummary {
  id: string
  name: string
  status: "ACTIVE" | "UNAVAILABLE"
  policy: null | { basePriceMinor: number; maximumRetailPriceMinor: number }
}

export function ProductAvailability({
  products,
}: {
  products: ProductSummary[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Product availability</CardTitle>
        <CardDescription className="leading-6">
          Publish a checker only when its pricing and inventory are ready.
          Making it unavailable immediately prevents new checkout without
          changing existing records.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {products.map((product) => (
          <ProductStatusControl key={product.id} product={product} />
        ))}
      </CardContent>
    </Card>
  )
}

function ProductStatusControl({ product }: { product: ProductSummary }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const isActive = product.status === "ACTIVE"

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setConfirmOpen(true)
  }

  async function changeStatus() {
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/products/${product.id}/status`, {
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
    <form
      className="flex flex-col gap-4 rounded-lg border p-4"
      onSubmit={submit}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{product.name}</p>
          <p className="text-sm text-muted-foreground">
            {product.policy ? "Pricing configured" : "Pricing required"}
          </p>
        </div>
        <Badge variant={isActive ? "secondary" : "outline"}>
          {isActive ? "Available" : "Unavailable"}
        </Badge>
      </div>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`product-reason-${product.id}`}>
            Reason
          </FieldLabel>
          <Input
            id={`product-reason-${product.id}`}
            minLength={5}
            name="reason"
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
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={pending || (!isActive && !product.policy)}
          type="submit"
          variant={isActive ? "destructive" : "default"}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending
            ? "Saving…"
            : isActive
              ? "Make unavailable"
              : "Publish product"}
        </Button>
        {message ? (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}
      </div>
      <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>
              {isActive
                ? "Make this product unavailable?"
                : "Publish this product?"}
            </DialogTitle>
            <DialogDescription>
              {isActive
                ? "New checkout will be prevented immediately. Existing records are unchanged."
                : "The checker will be available for new checkout once published."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setConfirmOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false)
                void changeStatus()
              }}
              type="button"
              variant={isActive ? "destructive" : "default"}
            >
              {isActive ? "Make unavailable" : "Publish product"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </form>
  )
}
