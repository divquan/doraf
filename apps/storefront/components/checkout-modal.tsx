"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  CreditCardIcon,
  SecurityCheckIcon,
  ShoppingBag01Icon,
} from "@hugeicons/core-free-icons"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogDescription,
  DialogPopup,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { money } from "@workspace/ui/lib/format"
import { Secret } from "./_storefront/secret"
import {
  type CheckoutReveal,
  type CreatedOrder,
  type OrderStatus,
  type StorefrontProduct,
} from "./_storefront/types"

const SUCCESS_STATES: string[] = ["PAID", "SUCCESS"]
const PENDING_STATES: string[] = [
  "CREATED",
  "INITIALIZING",
  "PENDING_AUTHORIZATION",
  "VERIFYING",
  "RECONCILING",
]
const FAILED_STATES: string[] = ["FAILED", "ABANDONED"]
const COMPLETE_STATES: string[] = ["COMPLETE", "DELIVERED", "FULFILLED"]

function isSuccessfulStatus(status: OrderStatus | null): boolean {
  if (!status) return false
  const pState = status.paymentState?.toUpperCase()
  const pSubState = status.payment?.state?.toUpperCase()
  return (
    SUCCESS_STATES.includes(pState ?? "") ||
    SUCCESS_STATES.includes(pSubState ?? "")
  )
}

function isPendingStatus(status: OrderStatus | null): boolean {
  if (!status) return true
  const state =
    status.payment?.state?.toUpperCase() ?? status.paymentState?.toUpperCase()
  return PENDING_STATES.includes(state ?? "")
}

function isFailedStatus(status: OrderStatus | null): boolean {
  if (!status) return false
  return FAILED_STATES.includes(status.payment?.state?.toUpperCase() ?? "")
}

function isReconcilingStatus(status: OrderStatus | null): boolean {
  return status?.payment?.state?.toUpperCase() === "RECONCILING"
}

function isCompleteStatus(status: OrderStatus | null): boolean {
  if (!status) return false
  return COMPLETE_STATES.includes(status.fulfillmentState?.toUpperCase() ?? "")
}

function normalizePhone(value: string): string {
  const digits = value.replace(/[^0-9]/g, "")
  return digits.startsWith("0") ? `233${digits.slice(1)}` : digits
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function CheckoutModal({
  open,
  onOpenChange,
  products,
  webSalesId,
  initialProductId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: StorefrontProduct[]
  webSalesId: string
  initialProductId?: string
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [productId, setProductId] = useState(
    initialProductId || products[0]?.id || ""
  )
  const [quantity, setQuantity] = useState(1)

  // Step 1 Form fields
  const [deliveryPhone, setDeliveryPhone] = useState("")
  const [deliveryPhoneConfirmation, setDeliveryPhoneConfirmation] = useState("")
  const [deliveryEmail, setDeliveryEmail] = useState("")
  const [deliveryEmailConfirmation, setDeliveryEmailConfirmation] = useState("")

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Order & fulfillment state
  const [order, setOrder] = useState<CreatedOrder | null>(null)
  const [status, setStatus] = useState<OrderStatus | null>(null)
  const [reveal, setReveal] = useState<CheckoutReveal | null>(null)
  const [revealRetryNonce, setRevealRetryNonce] = useState(0)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const copiedTimer = useRef<number | null>(null)
  const revealRequested = useRef(false)

  // Sync the selected product when a new one is requested (e.g. "Buy Now" on a
  // different checker). Adjusting state during render follows the React pattern
  // for deriving state from a changing prop.
  const [prevInitialProductId, setPrevInitialProductId] =
    useState(initialProductId)
  if (initialProductId && initialProductId !== prevInitialProductId) {
    setPrevInitialProductId(initialProductId)
    setProductId(initialProductId)
  }

  const product = useMemo(
    () => products.find((item) => item.id === productId) ?? products[0],
    [productId, products]
  )

  // Stable per-order idempotency key. Scoped to this checkout session so retries
  // and double-submits reuse the same reservation, while a fresh session (repeat
  // purchase) always gets a new key. The payload is included so changing product,
  // quantity, or phone starts a distinct reservation.
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID())
  const idempotencyKey = useMemo(
    () =>
      `${sessionId}:${product?.id ?? "none"}:${quantity}:${deliveryPhone.trim()}`,
    [sessionId, product?.id, quantity, deliveryPhone]
  )

  // Poll order status when order is created
  useEffect(() => {
    if (!order || !open) return
    let cancelled = false
    const requestController = new AbortController()
    revealRequested.current = false

    async function revealCodes() {
      if (revealRequested.current || reveal || !order?.checkoutAccessToken)
        return
      revealRequested.current = true
      try {
        const response = await fetch(
          `/api/checkout/${webSalesId}/${order.orderReference}/reveal`,
          {
            method: "POST",
            headers: { "x-checkout-token": order.checkoutAccessToken },
            cache: "no-store",
            signal: requestController.signal,
          }
        )
        if (!response.ok || cancelled) {
          if (!cancelled) {
            setError(
              response.status === 429
                ? "Voucher details are temporarily rate-limited. Please try again shortly."
                : "Voucher details are not ready yet. Please try again shortly."
            )
          }
          return
        }
        setReveal((await response.json()) as CheckoutReveal)
        window.clearInterval(timer)
      } catch {
        if (requestController.signal.aborted) return
        revealRequested.current = false
      }
    }

    async function refresh() {
      try {
        const response = await fetch(
          `/api/checkout/${webSalesId}/${order!.orderReference}`,
          { cache: "no-store", signal: requestController.signal }
        )
        if (!response.ok) return
        const next = (await response.json()) as OrderStatus
        if (cancelled) return
        setStatus(next)
        if (isSuccessfulStatus(next)) {
          setStep(3)
        }
        if (isSuccessfulStatus(next) && isCompleteStatus(next)) {
          window.clearInterval(timer)
          void revealCodes()
        }
      } catch {
        if (requestController.signal.aborted) return
        // Ignore transient poll error
      }
    }

    const timer = window.setInterval(() => void refresh(), 5_000)
    void refresh()
    return () => {
      cancelled = true
      window.clearInterval(timer)
      requestController.abort()
    }
  }, [open, order, reveal, revealRetryNonce, webSalesId])

  useEffect(() => {
    return () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current)
    }
  }, [])

  function handleReset() {
    setStep(1)
    setPending(false)
    setError(null)
    setOrder(null)
    setStatus(null)
    setReveal(null)
    setRevealRetryNonce(0)
    revealRequested.current = false
    setQuantity(1)
    setDeliveryPhone("")
    setDeliveryPhoneConfirmation("")
    setDeliveryEmail("")
    setDeliveryEmailConfirmation("")
    setCopiedKey(null)
    setSessionId(crypto.randomUUID())
  }

  function handleNextToPayment(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!deliveryPhone.trim()) {
      setError("Please enter your delivery mobile phone number.")
      return
    }
    if (
      normalizePhone(deliveryPhone) !==
      normalizePhone(deliveryPhoneConfirmation)
    ) {
      setError("Delivery phone numbers do not match. Please verify.")
      return
    }
    if (
      deliveryEmail &&
      normalizeEmail(deliveryEmail) !==
        normalizeEmail(deliveryEmailConfirmation)
    ) {
      setError("Delivery emails do not match. Please verify.")
      return
    }

    // Advance to Step 2 (Order Summary & Payment)
    setStep(2)
  }

  async function handleReserveOrder() {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/checkout/${webSalesId}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          productId: product?.id,
          quantity,
          deliveryPhone: deliveryPhone.trim(),
          deliveryPhoneConfirmation: deliveryPhoneConfirmation.trim(),
          deliveryEmail: deliveryEmail.trim() || undefined,
          deliveryEmailConfirmation:
            deliveryEmailConfirmation.trim() || undefined,
        }),
      })

      const result = (await response.json().catch(() => ({}))) as
        | CreatedOrder
        | { message?: string | string[] }

      if (!response.ok) {
        const message = "message" in result ? result.message : undefined
        throw new Error(
          Array.isArray(message)
            ? message.join(". ")
            : (message ?? "The order could not be reserved")
        )
      }

      const created = result as CreatedOrder
      setOrder(created)

      // Open Paystack popup if accessCode exists
      if (created.payment.accessCode && window.PaystackPop) {
        const popup = new window.PaystackPop()
        popup.resumeTransaction(created.payment.accessCode)
      }

      setStep(2)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The order could not be reserved"
      )
    } finally {
      setPending(false)
    }
  }

  function openPaystackCheckout() {
    if (order?.payment.accessCode && window.PaystackPop) {
      const popup = new window.PaystackPop()
      popup.resumeTransaction(order.payment.accessCode)
      return
    }
    setError("Secure checkout is still loading. Please try again in a moment.")
  }

  async function verifyPaymentManually() {
    if (!order) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/checkout/${webSalesId}/${order.orderReference}`,
        {
          method: "POST",
          headers: { "x-checkout-token": order.checkoutAccessToken },
        }
      )
      const result = (await response.json().catch(() => ({}))) as
        | OrderStatus
        | { message?: string | string[] }
      if (!response.ok) {
        const message = "message" in result ? result.message : undefined
        throw new Error(
          Array.isArray(message)
            ? message.join(". ")
            : (message ?? "The payment result could not be verified")
        )
      }
      const updatedStatus = result as OrderStatus
      setStatus(updatedStatus)
      if (isSuccessfulStatus(updatedStatus)) {
        setStep(3)
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The payment result could not be verified"
      )
    } finally {
      setPending(false)
    }
  }

  async function retryPayment() {
    if (!order) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/checkout/${webSalesId}/${order.orderReference}/retry`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": `${sessionId}:retry:${crypto.randomUUID()}`,
            "x-checkout-token": order.checkoutAccessToken,
          },
          body: "{}",
        }
      )
      const result = (await response.json().catch(() => ({}))) as
        | CreatedOrder
        | { message?: string | string[] }
      if (!response.ok) {
        const message = "message" in result ? result.message : undefined
        throw new Error(
          Array.isArray(message)
            ? message.join(". ")
            : (message ?? "The payment could not be retried")
        )
      }
      const retried = result as CreatedOrder
      setOrder(retried)
      setStatus(null)
      setReveal(null)
      revealRequested.current = false
      if (retried.payment.accessCode && window.PaystackPop) {
        const popup = new window.PaystackPop()
        popup.resumeTransaction(retried.payment.accessCode)
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The payment could not be retried"
      )
    } finally {
      setPending(false)
    }
  }

  async function copyToClipboard(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current)
      copiedTimer.current = window.setTimeout(() => setCopiedKey(null), 1800)
    } catch {
      setError("Please copy manually.")
    }
  }

  const isComplete = isCompleteStatus(status)
  const paymentFailed = isFailedStatus(status)
  const paymentReconciling = isReconcilingStatus(status)
  const paymentPending = isPendingStatus(status)

  const header =
    step === 1
      ? {
          icon: ShoppingBag01Icon,
          title: product?.name || "Results Checker",
          description:
            product?.scopeDisclosure ||
            "Choose your quantity and delivery details.",
        }
      : step === 2
        ? {
            icon: SecurityCheckIcon,
            title: "Confirm and pay",
            description:
              "Pay with Mobile Money and your checkers are delivered instantly.",
          }
        : {
            icon: CheckmarkCircle02Icon,
            title: "Payment confirmed",
            description: "Your checkers are ready below and on the way by SMS.",
          }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-xl overflow-hidden rounded-2xl border-border/80 bg-background p-0 shadow-2xl">
        <div className="border-b bg-muted/30 px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <HugeiconsIcon
                  icon={header.icon}
                  className="size-5"
                  strokeWidth={1.8}
                />
              </span>
              <div className="min-w-0">
                <DialogTitle className="font-heading text-xl font-semibold text-balance text-foreground">
                  {header.title}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm leading-6 text-pretty text-muted-foreground">
                  {header.description}
                </DialogDescription>
              </div>
            </div>
          </div>

          <div
            className="mt-4 flex items-center gap-1.5"
            role="progressbar"
            aria-label="Checkout progress"
            aria-valuemin={1}
            aria-valuemax={3}
            aria-valuenow={step}
          >
            <div
              className={`h-1 flex-1 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-muted"}`}
            />
            <div
              className={`h-1 flex-1 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-muted"}`}
            />
            <div
              className={`h-1 flex-1 rounded-full transition-colors ${step >= 3 ? "bg-emerald-600" : "bg-muted"}`}
            />
          </div>
        </div>

        <div className="p-6">
          {error && (
            <Alert variant="destructive" className="mb-4 py-3">
              <AlertTitle className="text-xs font-semibold">
                Action required
              </AlertTitle>
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {/* STEP 1: Product & Delivery Info */}
          {step === 1 && (
            <form onSubmit={handleNextToPayment} className="space-y-5">
              <FieldSet>
                <FieldGroup>
                  <Field>
                    <FieldLabel className="font-semibold">Quantity</FieldLabel>
                    <ToggleGroup
                      value={[String(quantity)]}
                      onValueChange={(values) => {
                        const selected = Number(values[0])
                        if (selected >= 1 && selected <= 5)
                          setQuantity(selected)
                      }}
                      variant="outline"
                      className="justify-start gap-2"
                    >
                      {[1, 2, 3, 4, 5].map((val) => (
                        <ToggleGroupItem
                          key={val}
                          value={String(val)}
                          className="h-10 w-12 font-mono font-bold tabular-nums"
                        >
                          {val}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </Field>
                </FieldGroup>
              </FieldSet>

              <FieldSet>
                <FieldLegend>Delivery details</FieldLegend>
                <FieldDescription>
                  Checkers are sent by SMS to your phone. Email confirmation is
                  optional.
                </FieldDescription>
                <FieldGroup className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="m-phone">Delivery phone</FieldLabel>
                    <Input
                      id="m-phone"
                      type="tel"
                      placeholder="024 123 4567"
                      value={deliveryPhone}
                      onChange={(e) => setDeliveryPhone(e.target.value)}
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="m-phone-confirm">
                      Confirm delivery phone
                    </FieldLabel>
                    <Input
                      id="m-phone-confirm"
                      type="tel"
                      placeholder="Enter phone again"
                      value={deliveryPhoneConfirmation}
                      onChange={(e) =>
                        setDeliveryPhoneConfirmation(e.target.value)
                      }
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="m-email">
                      Email address (optional)
                    </FieldLabel>
                    <Input
                      id="m-email"
                      type="email"
                      placeholder="you@example.com"
                      value={deliveryEmail}
                      onChange={(e) => setDeliveryEmail(e.target.value)}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="m-email-confirm">
                      Confirm email
                    </FieldLabel>
                    <Input
                      id="m-email-confirm"
                      type="email"
                      placeholder="Enter email again"
                      value={deliveryEmailConfirmation}
                      onChange={(e) =>
                        setDeliveryEmailConfirmation(e.target.value)
                      }
                    />
                  </Field>
                </FieldGroup>
              </FieldSet>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Order total · {quantity}{" "}
                    {quantity === 1 ? "checker" : "checkers"}
                  </p>
                  <p className="font-heading text-2xl font-bold text-primary tabular-nums">
                    {product
                      ? money(
                          product.retailPriceMinor * quantity,
                          product.currency
                        )
                      : "—"}
                  </p>
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="shrink-0 font-semibold"
                >
                  Continue to payment
                  <HugeiconsIcon
                    data-icon="inline-end"
                    icon={ArrowRight02Icon}
                  />
                </Button>
              </div>
            </form>
          )}

          {/* STEP 2: Order Summary & Paystack Payment */}
          {step === 2 && (
            <div className="space-y-5">
              <OrderSummary
                productName={order?.productName ?? product?.name}
                quantity={order?.quantity ?? quantity}
                totalMinor={
                  order?.totalMinor ??
                  (product ? product.retailPriceMinor * quantity : undefined)
                }
                currency={order?.currency ?? product?.currency}
                deliveryPhone={order?.deliveryPhoneMask ?? deliveryPhone.trim()}
                deliveryEmail={
                  order?.deliveryEmailMask ??
                  (deliveryEmail.trim() || undefined)
                }
                orderReference={order?.orderReference}
              />

              {order ? (
                <div className="space-y-5">
                  <div
                    className={`space-y-2 rounded-2xl border p-4 ${paymentFailed ? "border-destructive/30 bg-destructive/10" : paymentReconciling ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}
                  >
                    <div
                      className={`flex items-center gap-2 text-xs font-bold tracking-wider uppercase ${paymentFailed ? "text-destructive" : paymentReconciling ? "text-amber-700" : "text-emerald-700"}`}
                    >
                      <span className="relative flex size-2">
                        <span
                          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${paymentFailed ? "bg-destructive" : paymentReconciling ? "bg-amber-400" : "bg-emerald-400"}`}
                        />
                        <span
                          className={`relative inline-flex size-2 rounded-full ${paymentFailed ? "bg-destructive" : paymentReconciling ? "bg-amber-500" : "bg-emerald-500"}`}
                        />
                      </span>
                      {paymentFailed
                        ? "Payment attempt ended"
                        : paymentReconciling
                          ? "Confirming payment"
                          : isSuccessfulStatus(status)
                            ? "Payment received"
                            : "Payment window active"}
                    </div>
                    <p
                      className={`text-xs leading-relaxed text-pretty ${paymentFailed ? "text-destructive/90" : paymentReconciling ? "text-amber-900/90" : "text-emerald-900/90"}`}
                    >
                      {paymentFailed
                        ? "This payment attempt was not completed. You can try again using the same order and price."
                        : paymentReconciling
                          ? "Paystack has not returned a final result yet. We are checking it safely; do not submit another payment while this message is shown."
                          : isSuccessfulStatus(status)
                            ? "Payment is confirmed. We are preparing your checker details."
                            : "The Paystack popup is open on your device. Complete the payment, then tap "}
                      {!paymentFailed &&
                        !paymentReconciling &&
                        !isSuccessfulStatus(status) && (
                          <strong className="font-bold">
                            &ldquo;I&apos;ve completed payment&rdquo;
                          </strong>
                        )}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {paymentFailed ? (
                      <Button
                        type="button"
                        onClick={retryPayment}
                        disabled={pending}
                        size="lg"
                        className="w-full"
                      >
                        {pending ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <HugeiconsIcon
                            data-icon="inline-start"
                            icon={CreditCardIcon}
                          />
                        )}
                        {pending
                          ? "Starting a new attempt…"
                          : "Try payment again"}
                      </Button>
                    ) : !isSuccessfulStatus(status) ? (
                      <Button
                        type="button"
                        onClick={verifyPaymentManually}
                        disabled={pending || paymentReconciling}
                        size="lg"
                        className="w-full"
                      >
                        {pending ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <HugeiconsIcon
                            data-icon="inline-start"
                            icon={CheckmarkCircle02Icon}
                          />
                        )}
                        {pending
                          ? "Verifying payment…"
                          : "I've completed payment"}
                      </Button>
                    ) : null}

                    {!isSuccessfulStatus(status) && !paymentFailed && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setError(null)
                            setStep(1)
                          }}
                          disabled={pending}
                        >
                          <HugeiconsIcon
                            data-icon="inline-start"
                            icon={ArrowLeft02Icon}
                          />
                          Back
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={openPaystackCheckout}
                          disabled={pending}
                          className="flex-1 text-muted-foreground hover:text-foreground"
                        >
                          <HugeiconsIcon
                            data-icon="inline-start"
                            icon={CreditCardIcon}
                          />
                          Re-open Paystack window
                        </Button>
                      </div>
                    )}
                  </div>

                  {paymentPending && (
                    <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                      <Spinner className="size-3 text-muted-foreground" />
                      Automatically checking payment status…
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 rounded-2xl border bg-muted/40 p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <HugeiconsIcon icon={CreditCardIcon} className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-balance">
                        Instant Mobile Money checkout
                      </p>
                      <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
                        Pay with MTN MoMo, Telecel, or AirtelTigo. Paystack
                        securely collects payment details in its hosted
                        checkout. Checkers are delivered immediately after
                        payment confirmation.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setError(null)
                        setStep(1)
                      }}
                      disabled={pending}
                    >
                      <HugeiconsIcon
                        data-icon="inline-start"
                        icon={ArrowLeft02Icon}
                      />
                      Back
                    </Button>

                    <Button
                      type="button"
                      onClick={handleReserveOrder}
                      disabled={pending}
                      size="lg"
                      className="flex-1"
                    >
                      {pending ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <HugeiconsIcon
                          data-icon="inline-start"
                          icon={CreditCardIcon}
                        />
                      )}
                      {pending ? "Processing order…" : "Proceed to payment"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Instant Voucher Code Delivery View */}
          {step === 3 && (
            <div className="space-y-5 py-1 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  className="size-7"
                  strokeWidth={1.8}
                />
              </div>

              <div>
                <Badge
                  variant="secondary"
                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                >
                  Payment confirmed
                </Badge>
                <h3 className="mt-2 font-heading text-2xl font-bold text-balance text-foreground">
                  Here are your checker codes
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Also sent by SMS to{" "}
                  <strong className="font-medium text-foreground">
                    {deliveryPhone || order?.deliveryPhoneMask}
                  </strong>
                </p>
              </div>

              {reveal?.vouchers.length ? (
                <div className="space-y-3 text-left">
                  {reveal.vouchers.map((voucher) => {
                    const idx = voucher.position - 1
                    return (
                      <div
                        key={voucher.position}
                        className="space-y-4 rounded-2xl border bg-muted/25 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">
                            Voucher {voucher.position} of{" "}
                            {reveal.vouchers.length}
                          </p>
                          <Badge variant="outline" className="shrink-0">
                            {reveal.product.name}
                          </Badge>
                        </div>

                        <dl className="grid gap-4 sm:grid-cols-2">
                          <Secret
                            copied={copiedKey === `s-${idx}`}
                            label="Serial number"
                            onCopy={() =>
                              copyToClipboard(voucher.serialNumber, `s-${idx}`)
                            }
                            value={voucher.serialNumber}
                          />
                          <Secret
                            copied={copiedKey === `p-${idx}`}
                            label="PIN"
                            onCopy={() =>
                              copyToClipboard(voucher.pin, `p-${idx}`)
                            }
                            value={voucher.pin}
                            valueClassName="text-emerald-600"
                          />
                        </dl>
                      </div>
                    )
                  })}
                </div>
              ) : isComplete ? (
                <div className="space-y-3 rounded-2xl border border-dashed p-6 text-center">
                  <Spinner className="mx-auto size-7 text-emerald-600" />
                  <p className="text-sm font-semibold">
                    Allocating your checker PINs…
                  </p>
                  <p className="text-xs text-pretty text-muted-foreground">
                    Your vouchers are being fetched securely. They will appear
                    here in just a few seconds.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setError(null)
                      setRevealRetryNonce((value) => value + 1)
                    }}
                  >
                    Try loading codes again
                  </Button>
                </div>
              ) : status?.fulfillmentState === "EXCEPTION" ? (
                <div className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-left">
                  <p className="text-sm font-semibold text-amber-800">
                    Payment received; delivery needs attention
                  </p>
                  <p className="text-xs leading-relaxed text-pretty text-amber-900/90">
                    Please keep your order reference. If your checker does not
                    arrive, use the secure recovery page below.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-dashed p-6 text-center">
                  <Spinner className="mx-auto size-7 text-emerald-600" />
                  <p className="text-sm font-semibold">
                    Confirming your payment…
                  </p>
                  <p className="text-xs text-pretty text-muted-foreground">
                    We will show your checker details as soon as payment and
                    allocation are complete.
                  </p>
                </div>
              )}

              {order && (
                <div className="space-y-2 rounded-xl border bg-muted/30 p-4 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      Order reference
                    </span>
                    <button
                      type="button"
                      className="min-h-11 rounded-md px-2 font-mono text-xs font-semibold text-primary underline-offset-4 hover:underline"
                      onClick={() =>
                        copyToClipboard(order.orderReference, "order-reference")
                      }
                    >
                      {copiedKey === "order-reference"
                        ? "Copied"
                        : order.orderReference}
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
                    Keep this reference for support or secure purchase recovery
                    if you close this window.
                  </p>
                  <a
                    className="inline-flex min-h-11 items-center text-xs font-semibold text-primary underline-offset-4 hover:underline"
                    href="/recover"
                  >
                    Open purchase recovery
                  </a>
                </div>
              )}

              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                size="lg"
                className="mt-2 w-full"
              >
                Done
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleReset}
                className="w-full"
              >
                Start another checkout
              </Button>
            </div>
          )}
        </div>
      </DialogPopup>
    </Dialog>
  )
}

function OrderSummary({
  productName,
  quantity,
  totalMinor,
  currency,
  deliveryPhone,
  deliveryEmail,
  orderReference,
}: {
  productName?: string
  quantity: number
  totalMinor?: number
  currency?: string
  deliveryPhone: string
  deliveryEmail?: string
  orderReference?: string
}) {
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Order item</p>
          <p className="font-heading text-lg font-bold text-balance">
            {quantity}× {productName}
          </p>
        </div>
        <Badge
          variant="secondary"
          className="shrink-0 font-mono text-sm tabular-nums"
        >
          {totalMinor !== undefined && currency
            ? money(totalMinor, currency)
            : "—"}
        </Badge>
      </div>

      <Separator />

      <dl className="grid gap-4 sm:grid-cols-2">
        {orderReference && (
          <div>
            <dt className="text-xs text-muted-foreground">Order reference</dt>
            <dd className="mt-0.5 font-mono font-medium text-foreground">
              {orderReference}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-muted-foreground">Delivery SMS phone</dt>
          <dd className="mt-0.5 font-mono font-medium text-foreground">
            {deliveryPhone}
          </dd>
        </div>
        {deliveryEmail && (
          <div>
            <dt className="text-xs text-muted-foreground">
              Email confirmation
            </dt>
            <dd className="mt-0.5 font-medium break-all text-foreground">
              {deliveryEmail}
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}
