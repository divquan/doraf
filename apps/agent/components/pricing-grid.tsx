"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  PencilEdit02Icon,
  Store01Icon,
  Tag01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
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
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@workspace/ui/components/dialog"
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
            Dashchecker has not published checker price ranges yet. Your products will
            appear here as soon as they are ready.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
  const [modalOpen, setModalOpen] = useState(false)
  const [value, setValue] = useState(
    row.pricing.retailPriceMinor === null
      ? ""
      : (row.pricing.retailPriceMinor / 100).toFixed(2)
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isConfigured =
    typeof row.pricing.retailPriceMinor === "number" && row.pricing.retailPriceMinor > 0

  const parsedMinor = Math.round(Number(value) * 100)
  const valid =
    Number.isInteger(parsedMinor) &&
    parsedMinor >= row.pricing.basePriceMinor &&
    parsedMinor <= row.pricing.maximumRetailPriceMinor

  const profitMinor = valid ? parsedMinor - row.pricing.basePriceMinor : null

  function openChangeModal() {
    setError(null)
    setSuccess(null)
    if (!value && row.pricing.basePriceMinor) {
      setValue((row.pricing.basePriceMinor / 100).toFixed(2))
    }
    setModalOpen(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || readOnly) return
    setPending(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/agent-auth/prices/${row.product.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ retailPriceMinor: parsedMinor }),
      })

      const body = (await response.json().catch(() => ({}))) as {
        message?: string
      }

      if (!response.ok) {
        throw new Error(body.message ?? "The price could not be saved")
      }

      setSuccess("Price updated! Your storefront is now active for this product.")
      setTimeout(() => {
        setModalOpen(false)
        router.refresh()
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : "The price could not be saved")
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Card
        className={`flex flex-col justify-between overflow-hidden border-border/75 shadow-sm transition-all hover:shadow-md ${
          !isConfigured ? "bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30" : ""
        }`}
      >
        <CardHeader className="gap-4 border-b bg-muted/20 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl border bg-background text-primary shadow-xs">
              <HugeiconsIcon icon={Tag01Icon} strokeWidth={1.7} className="size-5" />
            </div>
            {isConfigured ? (
              <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium">
                Active on Store
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
                Price Not Set
              </Badge>
            )}
          </div>
          <div>
            <CardTitle className="text-xl">{row.product.name}</CardTitle>
            <CardDescription className="mt-1 line-clamp-2 leading-5">
              {row.product.scopeDisclosure}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-5">
          {/* Active Retail & Profit Metrics */}
          {isConfigured ? (
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Buyer Retail Price"
                value={money(row.pricing.retailPriceMinor!)}
                highlight
              />
              <Metric
                label="Your Profit / Sale"
                value={money(row.pricing.profitMinor || 0)}
                emerald
              />
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-start gap-2">
                <HugeiconsIcon icon={InformationCircleIcon} className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold">Not visible to buyers</p>
                  <p className="leading-relaxed opacity-90">
                    Set your buyer retail price to publish this product on your storefront.
                  </p>
                </div>
              </div>
            </div>
          )}

        </CardContent>

        <CardFooter className="border-t bg-muted/15 pt-4">
          <Button
            onClick={openChangeModal}
            disabled={readOnly}
            variant={isConfigured ? "outline" : "default"}
            className="w-full gap-2 font-medium"
          >
            <HugeiconsIcon icon={PencilEdit02Icon} className="size-4" />
            {isConfigured ? "Change Price" : "Set Price & Publish"}
          </Button>
        </CardFooter>
      </Card>

      {/* Change Price Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogPopup className="max-w-lg">
          <form onSubmit={submit}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  {row.product.code}
                </Badge>
                {isConfigured ? (
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    Currently Live
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    Price Not Set
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-xl mt-1">
                {isConfigured ? "Change Retail Price" : "Set Initial Retail Price"}
              </DialogTitle>
              <DialogDescription>
                Configure the price buyers pay for <strong>{row.product.name}</strong> on your storefront.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-5">
              {/* Informational Banner */}
              <div className="rounded-xl border bg-muted/30 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
                <HugeiconsIcon icon={Store01Icon} className="mt-0.5 size-4 text-primary shrink-0" />
                <p className="leading-5">
                  This product will immediately appear on your storefront at this price once saved.
                </p>
              </div>

              {/* Price Limits Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Dashchecker Base Price</p>
                  <p className="mt-1 font-mono text-base font-semibold">{money(row.pricing.basePriceMinor)}</p>
                  <p className="text-[10px] text-muted-foreground">Cost deducted on sale</p>
                </div>
                <div className="rounded-xl border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Max Allowed Price</p>
                  <p className="mt-1 font-mono text-base font-semibold">{money(row.pricing.maximumRetailPriceMinor)}</p>
                  <p className="text-[10px] text-muted-foreground">Maximum price cap</p>
                </div>
              </div>

              {/* Price Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`modal-price-${row.product.id}`} className="font-semibold">
                    New Buyer Price (GHS)
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Range: {(row.pricing.basePriceMinor / 100).toFixed(2)} - {(row.pricing.maximumRetailPriceMinor / 100).toFixed(2)}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-muted-foreground">
                    GHS
                  </span>
                  <Input
                    id={`modal-price-${row.product.id}`}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={(row.pricing.basePriceMinor / 100).toFixed(2)}
                    max={(row.pricing.maximumRetailPriceMinor / 100).toFixed(2)}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={(row.pricing.basePriceMinor / 100).toFixed(2)}
                    disabled={pending || readOnly}
                    className="h-12 pl-14 font-mono text-lg font-bold"
                    autoFocus
                  />
                </div>
              </div>

              {/* Dynamic Profit Preview */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                    Your Net Profit / Sale
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400/80 mt-0.5">
                    Credited to your earnings balance on purchase
                  </p>
                </div>
                <p className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {profitMinor === null || profitMinor < 0
                    ? "—"
                    : `+ ${money(profitMinor)}`}
                </p>
              </div>

              {/* Alerts */}
              {error && (
                <Alert variant="destructive" className="py-2.5">
                  <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
                  <AlertTitle className="text-xs">Error</AlertTitle>
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 py-2.5">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 text-emerald-600" />
                  <AlertDescription className="text-xs font-medium">{success}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <DialogClose
                render={
                  <Button type="button" variant="outline" disabled={pending}>
                    Cancel
                  </Button>
                }
              />
              <Button
                type="submit"
                disabled={!valid || pending || readOnly}
                className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-28"
              >
                {pending ? "Saving…" : "Save & Publish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
    </>
  )
}

function Metric({
  label,
  value,
  highlight,
  emerald,
}: {
  label: string
  value: string
  highlight?: boolean
  emerald?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        emerald
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
          : "bg-background"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-mono text-lg font-bold ${
          emerald
            ? "text-emerald-700 dark:text-emerald-400"
            : highlight
              ? "text-primary"
              : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  )
}
