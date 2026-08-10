"use client"

import { useEffect, useRef, useState } from "react"
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
  const startedRef = useRef(false)

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
        onOpenChange(false)
        onCompleted?.()
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
      if (next) setStep(1)
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
      if (next) setStep(2)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The prices could not be saved"
      )
      setPendingAction(null)
    }
  }

  async function reviewProductsAndContinue() {
    const next = await record("PRODUCTS_REVIEWED")
    if (next) setStep(3)
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
    onOpenChange(nextOpen)
    if (!nextOpen && state.status !== "COMPLETED" && !pendingAction) {
      void record("DISMISS")
    }
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

  if (readOnly || state.status === "COMPLETED") return null

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

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogPopup className="max-h-[min(92vh,760px)] max-w-5xl overflow-y-auto p-0 md:overflow-hidden">
          <div className="flex min-h-[560px] flex-col md:min-h-[620px] md:flex-row">
            <aside className="hidden w-64 shrink-0 flex-col border-r bg-muted/20 p-6 md:flex">
              <DashcheckerMark variant="agent" />

              <div className="mt-14 flex flex-1 flex-col">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Store setup
                </p>
                <h2 className="mt-3 max-w-[12rem] font-heading text-xl font-semibold tracking-tight">
                  Get your store ready to sell.
                </h2>
                <p className="mt-2 max-w-[13rem] text-sm leading-5 text-muted-foreground">
                  Complete these quick steps and you&apos;re ready to share your
                  store.
                </p>

                <div className="mt-10 flex flex-col gap-2">
                  {state.steps.map((item, index) => {
                    const active = index === step
                    return (
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                          active
                            ? "bg-background font-medium text-foreground shadow-sm"
                            : item.complete
                              ? "text-foreground"
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
                                ? "border-foreground text-foreground"
                                : "border-border text-muted-foreground"
                          )}
                        >
                          {item.complete ? (
                            <HugeiconsIcon icon={CheckmarkCircle02Icon} />
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

              <p className="text-xs leading-5 text-muted-foreground">
                Progress saves automatically. You can finish setup any time.
              </p>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col bg-background">
              <div className="flex items-center justify-between px-6 pt-7 sm:px-12 sm:pt-10">
                <span className="text-xs font-medium text-muted-foreground">
                  Step {step + 1} of {state.totalSteps}
                </span>
                <span className="text-xs text-muted-foreground">
                  {state.completedCount} complete
                </span>
              </div>

              <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-8 sm:px-12 sm:py-12">
                <DialogHeader className="gap-3 text-left">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <HugeiconsIcon icon={stepIcons[step] ?? Store01Icon} />
                  </div>
                  <DialogTitle className="font-heading text-2xl tracking-tight sm:text-3xl">
                    {stepTitle}
                  </DialogTitle>
                  <DialogDescription className="max-w-lg leading-6">
                    {stepDescription}{" "}
                    {step === 0 ? `Welcome, ${firstName}.` : null}
                  </DialogDescription>
                </DialogHeader>

                {error ? (
                  <p className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                <div className="mt-9 flex flex-1 flex-col">
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
                          onChange={(event) => setStoreName(event.target.value)}
                          placeholder="Ama's Checkers"
                          value={storeName}
                        />
                        <FieldDescription>
                          This is the name buyers will see on your storefront.
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
                    <FieldGroup>
                      {state.prices.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                          Pricing is being prepared. You can come back to this
                          step later.
                        </div>
                      ) : (
                        state.prices.map((row) => {
                          const parsed = parsedPrice(row)
                          const valid = isPriceValid(row)
                          return (
                            <Field
                              className="rounded-xl border p-4"
                              key={row.product.id}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                  <FieldLabel
                                    htmlFor={`onboarding-price-${row.product.id}`}
                                  >
                                    {row.product.name}
                                  </FieldLabel>
                                  <FieldDescription>
                                    {money(
                                      row.pricing.basePriceMinor,
                                      row.pricing.currency
                                    )}
                                    –
                                    {money(
                                      row.pricing.maximumRetailPriceMinor,
                                      row.pricing.currency
                                    )}{" "}
                                    range
                                    {valid
                                      ? ` · ${money(parsed - row.pricing.basePriceMinor, row.pricing.currency)} profit`
                                      : ""}
                                  </FieldDescription>
                                </div>
                                <div className="flex w-full max-w-[220px] items-center gap-2 sm:w-auto">
                                  <Input
                                    aria-label={`${row.product.name} buyer price`}
                                    id={`onboarding-price-${row.product.id}`}
                                    inputMode="decimal"
                                    onChange={(event) =>
                                      setPrices((previous) => ({
                                        ...previous,
                                        [row.product.id]: event.target.value,
                                      }))
                                    }
                                    placeholder="0.00"
                                    value={prices[row.product.id] ?? ""}
                                  />
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
                          className="flex items-center gap-3 rounded-xl border p-4"
                          key={row.product.id}
                        >
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                            <HugeiconsIcon icon={Tag01Icon} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {row.product.name}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {row.product.status === "ACTIVE"
                                ? "Ready to sell"
                                : "Currently unavailable"}
                            </p>
                          </div>
                          <Badge
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
                      ))}
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="flex flex-col gap-5">
                      <div className="rounded-2xl border bg-muted/20 p-5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Your public storefront link
                        </p>
                        <p className="mt-3 font-mono text-sm font-semibold break-all text-foreground">
                          {state.storefront.url}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <Button
                            onClick={() => void markStorefrontShared()}
                            type="button"
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
                          >
                            <HugeiconsIcon
                              icon={Link02Icon}
                              data-icon="inline-start"
                            />
                            Open store
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Share this link wherever your buyers already spend time.
                        You can always find it again in My Store.
                      </p>
                    </div>
                  ) : null}
                </div>

                <DialogFooter className="mt-10 flex-row items-center justify-between border-t pt-6">
                  <Button
                    disabled={step === 0 || pendingAction !== null}
                    onClick={() =>
                      setStep((current) => Math.max(0, current - 1))
                    }
                    type="button"
                    variant="ghost"
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
                          ? setStep(3)
                          : void reviewProductsAndContinue()
                      }
                      type="button"
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
        </DialogPopup>
      </Dialog>
    </>
  )
}
