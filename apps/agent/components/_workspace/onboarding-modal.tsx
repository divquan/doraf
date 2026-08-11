"use client"

import { type CSSProperties, useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  InformationCircleIcon,
  Link02Icon,
  Store01Icon,
  Tag01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { money } from "@workspace/ui/lib/format"
import { cn } from "@workspace/ui/lib/utils"
import { DashcheckerMark } from "@/components/dashchecker-mark"
import { getStorefrontConfig } from "@/lib/storefront-url"

export interface OnboardingPricingRow {
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

export interface OnboardingState {
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"
  currentStep: number
  completedCount: number
  totalSteps: number
  startedAt: string | null
  completedAt: string | null
  lastDismissedAt: string | null
  steps: Array<{
    id: "store" | "prices" | "products" | "share"
    title: string
    description: string
    complete: boolean
  }>
  prices: OnboardingPricingRow[]
  storefront: {
    url: string
    storeName: string | null
    slug: string | null
    webSalesId: string
  }
}

type Action =
  | "START"
  | "STOREFRONT_CONFIGURED"
  | "PRICES_CONFIGURED"
  | "PRODUCTS_REVIEWED"
  | "STOREFRONT_SHARED"
  | "COMPLETE"
  | "DISMISS"

const stepIcons = [Store01Icon, Tag01Icon, InformationCircleIcon, Link02Icon]

const confettiPalette = [
  "var(--primary)",
  "#e8a33d",
  "#4eaa8a",
  "#d8735c",
  "#6b86c7",
]

function CompletionConfetti() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {Array.from({ length: 22 }, (_, index) => {
        const left = 6 + ((index * 37) % 88)
        const top = 3 + ((index * 19) % 28)
        const drift = (index % 2 === 0 ? 1 : -1) * (18 + ((index * 13) % 34))
        const style = {
          "--confetti-color": confettiPalette[index % confettiPalette.length],
          "--confetti-delay": `${(index % 8) * 55}ms`,
          "--confetti-drift": `${drift}px`,
          "--confetti-left": `${left}%`,
          "--confetti-rotate": `${index % 2 === 0 ? 1 : -1}${90 + ((index * 23) % 180)}deg`,
          "--confetti-top": `${top}%`,
        } as CSSProperties

        return (
          <span
            className="onboarding-confetti-piece"
            key={index}
            style={style}
          />
        )
      })}
    </div>
  )
}

function CompletionReveal({ storeName }: { storeName: string | null }) {
  return (
    <div className="relative flex min-h-[560px] flex-1 items-center justify-center overflow-hidden px-6 py-12 sm:px-12">
      <CompletionConfetti />
      <div className="onboarding-reveal-content relative z-10 flex max-w-md flex-col items-center text-center">
        <div className="onboarding-reveal-mark flex size-20 items-center justify-center rounded-[1.75rem] bg-primary text-primary-foreground shadow-[0_16px_36px_-12px_color-mix(in_oklch,var(--primary),transparent_25%)]">
          <HugeiconsIcon className="size-10" icon={CheckmarkCircle02Icon} />
        </div>
        <p className="mt-8 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
          Setup complete
        </p>
        <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          You&apos;re ready to share.
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-6 text-pretty text-muted-foreground">
          {storeName ? `${storeName} is` : "Your store is"} live and ready for
          its first buyer. Nice work getting everything in place.
        </p>
        <div className="mt-8 flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-xs font-medium text-primary">
          <span className="size-1.5 rounded-full bg-primary" />
          Taking you to your workspace
        </div>
      </div>
    </div>
  )
}

function firstIncompleteStep(state: OnboardingState): number {
  const index = state.steps.findIndex((step) => !step.complete)
  return index === -1 ? state.steps.length - 1 : index
}

function priceValue(row: OnboardingPricingRow): string {
  return row.pricing.retailPriceMinor === null
    ? ""
    : (row.pricing.retailPriceMinor / 100).toFixed(2)
}

export function OnboardingModal({
  agentName,
  initialState,
  readOnly,
  open,
  onOpenChange,
  onCompleted,
}: {
  agentName: string
  initialState: OnboardingState
  readOnly: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onCompleted?: () => void
}) {
  const [state, setState] = useState(initialState)
  const [step, setStep] = useState(() => firstIncompleteStep(initialState))
  const [storeName, setStoreName] = useState(
    initialState.storefront.storeName ?? ""
  )
  const [slug, setSlug] = useState(initialState.storefront.slug ?? "")
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialState.prices.map((row) => [row.product.id, priceValue(row)])
    )
  )
  const [pendingAction, setPendingAction] = useState<Action | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [celebrating, setCelebrating] = useState(false)
  const [stepDirection, setStepDirection] = useState<"backward" | "forward">(
    "forward"
  )
  const startedRef = useRef(false)
  const completionTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (
      !open ||
      readOnly ||
      startedRef.current ||
      state.status === "COMPLETED"
    ) {
      return
    }
    startedRef.current = true
    void record("START")
    // record is intentionally called once when the modal first opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, readOnly, state.status])

  function hydrate(next: OnboardingState) {
    setState(next)
    setStoreName(next.storefront.storeName ?? "")
    setSlug(next.storefront.slug ?? "")
    setPrices(
      Object.fromEntries(
        next.prices.map((row) => [row.product.id, priceValue(row)])
      )
    )
  }

  async function record(action: Action): Promise<OnboardingState | null> {
    setPendingAction(action)
    setError(null)
    try {
      const response = await fetch("/api/agent-auth/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const body = (await response.json().catch(() => ({}))) as
        | OnboardingState
        | { message?: string }
      if (!response.ok) {
        throw new Error(
          "message" in body && body.message
            ? body.message
            : "Onboarding could not be updated"
        )
      }
      const next = body as OnboardingState
      hydrate(next)
      if (action === "COMPLETE") {
        setCelebrating(true)
        onCompleted?.()
        completionTimerRef.current = window.setTimeout(() => {
          setCelebrating(false)
          onOpenChange(false)
        }, 1900)
      }
      return next
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong")
      return null
    } finally {
      setPendingAction(null)
    }
  }

  async function saveStorefrontAndContinue() {
    const nextStoreName = storeName.trim()
    const nextSlug = slug.trim().toLowerCase()
    if (!nextStoreName) {
      setError("Add a store name so buyers know who they are buying from.")
      return
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(nextSlug) || nextSlug.length < 3) {
      setError(
        "Use a store link with 3–30 lowercase letters, numbers, or hyphens."
      )
      return
    }

    setPendingAction("STOREFRONT_CONFIGURED")
    setError(null)
    try {
      const response = await fetch("/api/agent-auth/storefront", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storeName: nextStoreName, slug: nextSlug }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        message?: string
      }
      if (!response.ok) {
        throw new Error(body.message ?? "The storefront could not be saved")
      }
      const next = await record("STOREFRONT_CONFIGURED")
      if (next) moveToStep(1)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The storefront could not be saved"
      )
      setPendingAction(null)
    }
  }

  function parsedPrice(row: OnboardingPricingRow): number {
    return Math.round(Number(prices[row.product.id] ?? "") * 100)
  }

  function isPriceValid(row: OnboardingPricingRow): boolean {
    const parsed = parsedPrice(row)
    return (
      Number.isInteger(parsed) &&
      parsed >= row.pricing.basePriceMinor &&
      parsed <= row.pricing.maximumRetailPriceMinor
    )
  }

  async function savePricesAndContinue() {
    if (state.prices.length === 0 || !state.prices.every(isPriceValid)) {
      setError("Choose a valid price for every product before continuing.")
      return
    }

    setPendingAction("PRICES_CONFIGURED")
    setError(null)
    try {
      for (const row of state.prices) {
        const response = await fetch(
          `/api/agent-auth/prices/${row.product.id}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ retailPriceMinor: parsedPrice(row) }),
          }
        )
        const body = (await response.json().catch(() => ({}))) as {
          message?: string
        }
        if (!response.ok) {
          throw new Error(body.message ?? "A product price could not be saved")
        }
      }
      const next = await record("PRICES_CONFIGURED")
      if (next) moveToStep(2)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The prices could not be saved"
      )
      setPendingAction(null)
    }
  }

  async function reviewProductsAndContinue() {
    const next = await record("PRODUCTS_REVIEWED")
    if (next) moveToStep(3)
  }

  async function markStorefrontShared() {
    try {
      await navigator.clipboard.writeText(state.storefront.url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setError(
        "Copy failed. You can still select the link and copy it manually."
      )
    }
    await record("STOREFRONT_SHARED")
  }

  async function finish() {
    await record("COMPLETE")
  }

  function close(nextOpen: boolean) {
    if (!nextOpen && completionTimerRef.current !== null) {
      window.clearTimeout(completionTimerRef.current)
      completionTimerRef.current = null
      setCelebrating(false)
    }
    onOpenChange(nextOpen)
    if (!nextOpen && state.status !== "COMPLETED" && !pendingAction) {
      void record("DISMISS")
    }
  }

  function moveToStep(nextStep: number) {
    if (nextStep === step) return
    setStepDirection(nextStep > step ? "forward" : "backward")
    setStep(nextStep)
  }

  const storeComplete =
    state.steps.find((item) => item.id === "store")?.complete ?? false
  const pricesComplete =
    state.steps.find((item) => item.id === "prices")?.complete ?? false
  const productsComplete =
    state.steps.find((item) => item.id === "products")?.complete ?? false
  const shareComplete =
    state.steps.find((item) => item.id === "share")?.complete ?? false
  const firstName = agentName.split(/\s+/)[0] || agentName
  const storefrontConfig = getStorefrontConfig(state.storefront.url)
  const previewUrl = storefrontConfig.formatSubdomainUrl(
    slug.trim() || state.storefront.webSalesId
  )
  const storefrontProtocol = storefrontConfig.protocol.replace(":", "")

  if (readOnly || (state.status === "COMPLETED" && !celebrating)) return null

  const stepTitle = [
    "Set up your store",
    "Set your checker prices",
    "Check product availability",
    "Your store is ready to share",
  ][step]
  const stepDescription = [
    "Choose the name and web address buyers will use to find your store.",
    "Choose what buyers pay and see your profit before you publish.",
    "Make sure you know which products are ready to sell today.",
    "Copy your link into WhatsApp, social posts, or messages to reach buyers.",
  ][step]

  const progressStep = Math.min(step + 1, Math.max(state.totalSteps, 1))
  const progressValue = Math.round(
    (progressStep / Math.max(state.totalSteps, 1)) * 100
  )

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogPopup className="max-h-[min(92vh,760px)] max-w-5xl overflow-y-auto p-0">
          {celebrating ? (
            <CompletionReveal storeName={state.storefront.storeName} />
          ) : (
            <div className="flex min-h-[560px] flex-col md:min-h-[620px] md:flex-row">
              <aside className="relative hidden w-64 shrink-0 flex-col overflow-hidden border-r bg-muted/20 p-6 md:flex">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-20 -left-20 size-48 rounded-full bg-primary/10 blur-3xl"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-24 -bottom-20 size-56 rounded-full bg-primary/5 blur-3xl"
                />
                <DashcheckerMark variant="agent" />

                <div className="relative z-10 mt-14 flex flex-1 flex-col">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Store setup
                  </p>
                  <h2 className="mt-3 max-w-[12rem] font-heading text-xl font-semibold tracking-tight text-balance">
                    Get your store ready to sell.
                  </h2>
                  <p className="mt-2 max-w-[13rem] text-sm leading-5 text-pretty text-muted-foreground">
                    Complete these quick steps and you&apos;re ready to share
                    your store.
                  </p>

                  <div className="relative mt-10 flex flex-col gap-2">
                    <div
                      aria-hidden="true"
                      className="absolute top-[22px] bottom-[22px] left-6 w-px bg-border"
                    />
                    {state.steps.map((item, index) => {
                      const active = index === step
                      return (
                        <div
                          className={cn(
                            "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-[background-color,box-shadow,color] duration-300",
                            active
                              ? "bg-background/90 font-medium text-foreground shadow-sm ring-1 ring-primary/10"
                              : item.complete
                                ? "text-foreground/90"
                                : "text-muted-foreground"
                          )}
                          key={item.id}
                        >
                          <span
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                              item.complete
                                ? "border-primary bg-primary text-primary-foreground"
                                : active
                                  ? "border-primary/60 bg-background text-foreground"
                                  : "border-border text-muted-foreground"
                            )}
                          >
                            {item.complete ? (
                              <HugeiconsIcon
                                className="onboarding-check-pop"
                                icon={CheckmarkCircle02Icon}
                              />
                            ) : (
                              index + 1
                            )}
                          </span>
                          <span className="truncate">{item.title}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <p className="relative z-10 text-xs leading-5 text-muted-foreground">
                  Progress saves automatically. You can finish setup any time.
                </p>
              </aside>

              <div className="flex min-w-0 flex-1 flex-col bg-background">
                <div className="px-6 pt-7 sm:px-12 sm:pt-10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Step {step + 1} of {state.totalSteps}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {state.completedCount}/{state.totalSteps} complete
                    </span>
                  </div>
                  <div
                    aria-label={`Step ${progressStep} of ${state.totalSteps}`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={progressValue}
                    className="mt-3 h-1 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                      style={{ width: `${progressValue}%` }}
                    />
                  </div>
                </div>

                <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-8 sm:px-12 sm:py-12">
                  <div
                    className={cn(
                      "onboarding-step-enter flex flex-1 flex-col",
                      stepDirection === "forward"
                        ? "onboarding-step-enter-forward"
                        : "onboarding-step-enter-backward"
                    )}
                    key={`step-${step}`}
                  >
                    <DialogHeader className="gap-3 text-left">
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <HugeiconsIcon
                          className="onboarding-icon-pop"
                          icon={stepIcons[step] ?? Store01Icon}
                        />
                      </div>
                      <DialogTitle className="font-heading text-2xl tracking-tight text-balance sm:text-3xl">
                        {stepTitle}
                      </DialogTitle>
                      <DialogDescription className="max-w-lg leading-6 text-pretty">
                        {stepDescription}{" "}
                        {step === 0 ? `Welcome, ${firstName}.` : null}
                      </DialogDescription>
                    </DialogHeader>

                    {error ? (
                      <p className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {error}
                      </p>
                    ) : null}

                    <div className="onboarding-stagger mt-9 flex flex-1 flex-col">
                      {step === 0 ? (
                        <FieldGroup>
                          <Field>
                            <FieldLabel htmlFor="onboarding-store-name">
                              Store name
                            </FieldLabel>
                            <Input
                              autoFocus
                              id="onboarding-store-name"
                              maxLength={60}
                              onChange={(event) =>
                                setStoreName(event.target.value)
                              }
                              placeholder="Ama's Checkers"
                              value={storeName}
                            />
                            <FieldDescription>
                              This is the name buyers will see on your
                              storefront.
                            </FieldDescription>
                          </Field>
                          <Field>
                            <FieldLabel htmlFor="onboarding-store-link">
                              Store link
                            </FieldLabel>
                            <div className="flex h-9 items-center rounded-lg border border-input bg-background px-3 text-sm shadow-xs focus-within:ring-2 focus-within:ring-ring/50">
                              <span className="shrink-0 text-muted-foreground">
                                {storefrontProtocol}://
                              </span>
                              <Input
                                aria-describedby="onboarding-store-link-help"
                                className="h-auto min-w-0 flex-1 rounded-none border-0 bg-transparent px-1 font-mono shadow-none focus-visible:ring-0"
                                id="onboarding-store-link"
                                maxLength={30}
                                onChange={(event) =>
                                  setSlug(
                                    event.target.value
                                      .toLowerCase()
                                      .replace(/[^a-z0-9-]/g, "")
                                  )
                                }
                                placeholder="amas-checkers"
                                value={slug}
                              />
                              <span className="shrink-0 text-muted-foreground">
                                {storefrontConfig.suffix}
                              </span>
                            </div>
                            <FieldDescription id="onboarding-store-link-help">
                              Buyers will use this address to open your store:{" "}
                              <span className="font-mono">{previewUrl}</span>
                            </FieldDescription>
                          </Field>
                        </FieldGroup>
                      ) : null}

                      {step === 1 ? (
                        <FieldGroup className="grid gap-4 sm:grid-cols-2">
                          {state.prices.length === 0 ? (
                            <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                              Pricing is being prepared. You can come back to
                              this step later.
                            </div>
                          ) : (
                            state.prices.map((row) => {
                              const parsed = parsedPrice(row)
                              const valid = isPriceValid(row)
                              return (
                                <Field
                                  className="rounded-2xl border bg-card/60 p-4 shadow-xs transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-sm"
                                  key={row.product.id}
                                >
                                  <div className="flex flex-col gap-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-primary">
                                            {row.product.code}
                                          </span>
                                          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                                            Product
                                          </span>
                                        </div>
                                        <p className="mt-2 text-base font-semibold text-foreground">
                                          {row.product.name}
                                        </p>
                                        <FieldDescription className="mt-1 max-w-none text-[11px] leading-4 text-pretty">
                                          {row.product.scopeDisclosure}
                                        </FieldDescription>
                                      </div>
                                      <div className="shrink-0 rounded-xl bg-muted/60 px-2.5 py-1.5 text-right">
                                        <p className="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
                                          Allowed range
                                        </p>
                                        <p className="mt-0.5 font-mono text-xs font-semibold text-foreground tabular-nums">
                                          {money(
                                            row.pricing.basePriceMinor,
                                            row.pricing.currency
                                          )}
                                          <span className="px-1 text-muted-foreground">
                                            –
                                          </span>
                                          {money(
                                            row.pricing.maximumRetailPriceMinor,
                                            row.pricing.currency
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="grid gap-2 border-t pt-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                                      <div
                                        className={cn(
                                          "rounded-xl p-2.5",
                                          valid ? "bg-primary/5" : "bg-muted/50"
                                        )}
                                      >
                                        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                                          Profit per voucher
                                        </p>
                                        <p className="mt-0.5 font-mono text-base font-semibold text-primary tabular-nums">
                                          {valid
                                            ? money(
                                                parsed -
                                                  row.pricing.basePriceMinor,
                                                row.pricing.currency
                                              )
                                            : "—"}
                                        </p>
                                        <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                                          {valid
                                            ? "Your margin at this buyer price"
                                            : "Set a price within the allowed range"}
                                        </p>
                                      </div>
                                      <div className="flex flex-col gap-1.5">
                                        <FieldLabel
                                          htmlFor={`onboarding-price-${row.product.id}`}
                                          className="text-xs font-semibold"
                                        >
                                          Buyer price
                                        </FieldLabel>
                                        <div className="flex h-9 items-center rounded-xl border border-input bg-background px-2.5 shadow-xs transition-[border-color,box-shadow] duration-200 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                                          <span className="font-mono text-sm text-muted-foreground">
                                            GH₵
                                          </span>
                                          <Input
                                            aria-label={`${row.product.name} buyer price`}
                                            className="h-auto border-0 bg-transparent px-2 text-right font-mono text-base shadow-none focus-visible:ring-0 md:text-sm"
                                            id={`onboarding-price-${row.product.id}`}
                                            inputMode="decimal"
                                            onChange={(event) =>
                                              setPrices((previous) => ({
                                                ...previous,
                                                [row.product.id]:
                                                  event.target.value,
                                              }))
                                            }
                                            placeholder="0.00"
                                            value={prices[row.product.id] ?? ""}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </Field>
                              )
                            })
                          )}
                        </FieldGroup>
                      ) : null}

                      {step === 2 ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {state.prices.map((row) => (
                            <div
                              className="flex items-start gap-4 rounded-2xl border bg-card/60 p-4 shadow-xs transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-sm"
                              key={row.product.id}
                            >
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <HugeiconsIcon icon={Tag01Icon} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-foreground">
                                      {row.product.name}
                                    </p>
                                    <p className="mt-1 font-mono text-[10px] tracking-wide text-muted-foreground">
                                      {row.product.code}
                                    </p>
                                  </div>
                                  <Badge
                                    className="shrink-0"
                                    variant={
                                      row.product.status === "ACTIVE"
                                        ? "secondary"
                                        : "outline"
                                    }
                                  >
                                    {row.product.status === "ACTIVE"
                                      ? "Available"
                                      : "Unavailable"}
                                  </Badge>
                                </div>
                                <p className="mt-3 text-xs leading-5 text-pretty text-muted-foreground">
                                  {row.product.scopeDisclosure}
                                </p>
                                <div className="mt-3 flex items-center gap-2 text-xs font-medium text-foreground">
                                  <span
                                    className={cn(
                                      "size-1.5 rounded-full",
                                      row.product.status === "ACTIVE"
                                        ? "bg-emerald-500"
                                        : "bg-muted-foreground/50"
                                    )}
                                  />
                                  {row.product.status === "ACTIVE"
                                    ? "Ready to sell"
                                    : "Currently unavailable"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {step === 3 ? (
                        <div className="flex flex-col gap-5">
                          <div className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-5 shadow-xs">
                            <p className="text-xs font-medium text-muted-foreground">
                              Your public storefront link
                            </p>
                            <p className="mt-3 font-mono text-sm font-semibold break-all text-foreground selection:bg-primary/20">
                              {state.storefront.url}
                            </p>
                            <div className="mt-5 flex flex-wrap gap-2">
                              <Button
                                onClick={() => void markStorefrontShared()}
                                type="button"
                                className="min-h-10 active:scale-[0.96]"
                              >
                                <HugeiconsIcon
                                  icon={copied ? Tick02Icon : Copy01Icon}
                                  data-icon="inline-start"
                                />
                                {copied ? "Copied" : "Copy link"}
                              </Button>
                              <Button
                                onClick={() => void record("STOREFRONT_SHARED")}
                                render={
                                  <a
                                    href={state.storefront.url}
                                    rel="noreferrer"
                                    target="_blank"
                                  />
                                }
                                type="button"
                                variant="outline"
                                className="min-h-10 active:scale-[0.96]"
                              >
                                <HugeiconsIcon
                                  icon={Link02Icon}
                                  data-icon="inline-start"
                                />
                                Open store
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4 text-sm">
                            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                              <HugeiconsIcon
                                className="size-4"
                                icon={CheckmarkCircle02Icon}
                              />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                One last step, then you&apos;re live.
                              </p>
                              <p className="mt-1 leading-5 text-muted-foreground">
                                Copy the link once to confirm it&apos;s ready to
                                share.
                              </p>
                            </div>
                          </div>
                          <p className="text-sm leading-6 text-muted-foreground">
                            Share this link wherever your buyers already spend
                            time. You can always find it again in My Store.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <DialogFooter className="mt-auto flex-row items-center justify-between border-t pt-6">
                    <Button
                      disabled={step === 0 || pendingAction !== null}
                      onClick={() => moveToStep(Math.max(0, step - 1))}
                      type="button"
                      variant="ghost"
                      className="min-h-10 active:scale-[0.96]"
                    >
                      <HugeiconsIcon
                        icon={ArrowLeft01Icon}
                        data-icon="inline-start"
                      />
                      Go back
                    </Button>
                    {step === 0 ? (
                      <Button
                        disabled={
                          pendingAction !== null ||
                          !storeName.trim() ||
                          slug.trim().length < 3
                        }
                        onClick={() => void saveStorefrontAndContinue()}
                        type="button"
                        className="min-h-10 active:scale-[0.96]"
                      >
                        {pendingAction === "STOREFRONT_CONFIGURED" ? (
                          <Spinner data-icon="inline-start" />
                        ) : null}
                        Continue
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          data-icon="inline-end"
                        />
                      </Button>
                    ) : null}
                    {step === 1 ? (
                      <Button
                        disabled={
                          pendingAction !== null ||
                          state.prices.length === 0 ||
                          !state.prices.every(isPriceValid)
                        }
                        onClick={() => void savePricesAndContinue()}
                        type="button"
                        className="min-h-10 active:scale-[0.96]"
                      >
                        {pendingAction === "PRICES_CONFIGURED" ? (
                          <Spinner data-icon="inline-start" />
                        ) : null}
                        Continue
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          data-icon="inline-end"
                        />
                      </Button>
                    ) : null}
                    {step === 2 ? (
                      <Button
                        disabled={pendingAction !== null}
                        onClick={() =>
                          productsComplete
                            ? moveToStep(3)
                            : void reviewProductsAndContinue()
                        }
                        type="button"
                        className="min-h-10 active:scale-[0.96]"
                      >
                        {pendingAction === "PRODUCTS_REVIEWED" ? (
                          <Spinner data-icon="inline-start" />
                        ) : null}
                        {productsComplete ? "Reviewed" : "Continue"}
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          data-icon="inline-end"
                        />
                      </Button>
                    ) : null}
                    {step === 3 ? (
                      <Button
                        disabled={
                          pendingAction !== null ||
                          !shareComplete ||
                          !storeComplete ||
                          !pricesComplete ||
                          !productsComplete
                        }
                        onClick={() => void finish()}
                        type="button"
                        className="min-h-10 shadow-[0_8px_20px_-10px_color-mix(in_oklch,var(--primary),transparent_10%)] active:scale-[0.96]"
                      >
                        {pendingAction === "COMPLETE" ? (
                          <Spinner data-icon="inline-start" />
                        ) : null}
                        Finish setup
                        <HugeiconsIcon
                          icon={CheckmarkCircle02Icon}
                          data-icon="inline-end"
                        />
                      </Button>
                    ) : null}
                  </DialogFooter>
                </div>
              </div>
            </div>
          )}
        </DialogPopup>
      </Dialog>
    </>
  )
}
