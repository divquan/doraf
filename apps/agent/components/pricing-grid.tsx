"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon, Wallet01Icon } from "@hugeicons/core-free-icons"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
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
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { money } from "@workspace/ui/lib/format"

export interface AgentPricingRow {
  product: {
    id: string
    code: string
    name: string
    scopeDisclosure: string
    status: "ACTIVE" | "UNAVAILABLE"
  }
  pricing: {
    currency: string
    basePriceMinor: number
    maximumRetailPriceMinor: number
    retailPriceMinor: number | null
    profitMinor: number | null
    source: "DEFAULT" | "AGENT_OVERRIDE"
  }
}

export function PricingGrid({
  rows,
  readOnly,
}: {
  rows: AgentPricingRow[]
  readOnly: boolean
}) {
  if (rows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
          <p className="font-medium">Pricing is being prepared</p>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Doraf has not published checker price ranges yet. Your products will
            appear here as soon as they are ready.
          </p>
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {rows.map((row) => (
        <PriceCard key={row.product.id} row={row} readOnly={readOnly} />
      ))}
    </div>
  )
}

function PriceCard({
  row,
  readOnly,
}: {
  row: AgentPricingRow
  readOnly: boolean
}) {
  const router = useRouter()
  const [value, setValue] = useState(
    row.pricing.retailPriceMinor === null
      ? ""
      : (row.pricing.retailPriceMinor / 100).toFixed(2)
  )
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const parsedMinor = Math.round(Number(value) * 100)
  const valid =
    Number.isInteger(parsedMinor) &&
    parsedMinor >= row.pricing.basePriceMinor &&
    parsedMinor <= row.pricing.maximumRetailPriceMinor
  const profit = valid ? parsedMinor - row.pricing.basePriceMinor : null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || readOnly) return
    if (!confirming) {
      setConfirming(true)
      setMessage(null)
      return
    }
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/agent-auth/prices/${row.product.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ retailPriceMinor: parsedMinor }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        message?: string
      }
      if (!response.ok)
        throw new Error(body.message ?? "The price could not be saved")
      setMessage("Price saved")
      setConfirming(false)
      router.refresh()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The price could not be saved"
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="overflow-hidden border-border/75 shadow-sm">
      <CardHeader className="gap-4 border-b bg-muted/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl border bg-background text-primary shadow-xs">
            <HugeiconsIcon icon={Wallet01Icon} strokeWidth={1.7} />
          </div>
          <Badge
            variant={row.product.status === "ACTIVE" ? "secondary" : "outline"}
          >
            {row.product.status === "ACTIVE" ? "In stock" : "Unavailable"}
          </Badge>
        </div>
        <div>
          <CardTitle className="text-xl">{row.product.name}</CardTitle>
          <CardDescription className="mt-1 line-clamp-2 leading-5">
            {row.product.scopeDisclosure}
          </CardDescription>
        </div>
      </CardHeader>
      <form onSubmit={submit}>
        <CardContent className="space-y-5 pt-5">
          <div className="grid grid-cols-2 gap-3">
            <Metric
              label="Doraf base"
              value={money(row.pricing.basePriceMinor)}
            />
            <Metric
              label="Maximum"
              value={money(row.pricing.maximumRetailPriceMinor)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={`price-${row.product.id}`}>
                Your buyer price
              </Label>
              <span className="text-xs text-muted-foreground">GHS</span>
            </div>
            <Input
              id={`price-${row.product.id}`}
              type="number"
              inputMode="decimal"
              step="0.01"
              min={(row.pricing.basePriceMinor / 100).toFixed(2)}
              max={(row.pricing.maximumRetailPriceMinor / 100).toFixed(2)}
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
                setConfirming(false)
              }}
              disabled={readOnly || pending}
              placeholder={(row.pricing.basePriceMinor / 100).toFixed(2)}
              className="h-11 text-base font-medium"
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Profit per voucher:{" "}
              <span className="font-medium text-foreground">
                {profit === null ? "—" : money(profit)}
              </span>
            </p>
          </div>
          {message ? (
            <Alert className="py-3">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className="border-t bg-muted/15 pt-4">
          {confirming ? (
            <div className="flex w-full items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={pending}
              >
                {pending ? "Saving…" : "Confirm"}
              </Button>
            </div>
          ) : (
            <Button
              className="w-full"
              disabled={!valid || readOnly || pending}
              type="submit"
            >
              {pending
                ? "Saving…"
                : row.pricing.retailPriceMinor === null
                  ? "Set price"
                  : "Save new price"}
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-lg font-semibold">{value}</p>
    </div>
  )
}

