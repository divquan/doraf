"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  CreditCardIcon,
  InformationCircleIcon,
  SecurityCheckIcon,
  ShoppingBag01Icon,
  SparklesIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Spinner } from "@workspace/ui/components/spinner"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { money } from "@workspace/ui/lib/format"
import { type StorefrontProduct, type CreatedOrder, type OrderStatus } from "./storefront-checkout"

declare global {
  interface Window {
    PaystackPop?: new () => {
      resumeTransaction(accessCode: string): void
    }
  }
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
  const [productId, setProductId] = useState(initialProductId || products[0]?.id || "")
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Sync initial product if changed
  useEffect(() => {
    if (initialProductId) {
      setProductId(initialProductId)
    }
  }, [initialProductId])

  const product = useMemo(
    () => products.find((item) => item.id === productId) ?? products[0],
    [productId, products]
  )

  // Poll order status when order is created
  useEffect(() => {
    if (!order) return
    let cancelled = false
    async function refresh() {
      try {
        const response = await fetch(
          `/api/checkout/${webSalesId}/${order!.orderReference}`,
          { cache: "no-store" }
        )
        if (!response.ok) return
        const next = (await response.json()) as OrderStatus
        if (!cancelled) {
          setStatus(next)
          if (["SUCCESS", "RECONCILING"].includes(next.paymentState)) {
            setStep(3)
          }
        }
      } catch {
        // Ignore transient poll error
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 2_500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [order, webSalesId])

  function handleReset() {
    setStep(1)
    setPending(false)
    setError(null)
    setOrder(null)
    setStatus(null)
  }

  function handleNextToPayment(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!deliveryPhone.trim()) {
      setError("Please enter your delivery mobile phone number.")
      return
    }
    if (deliveryPhone.trim() !== deliveryPhoneConfirmation.trim()) {
      setError("Delivery phone numbers do not match. Please verify.")
      return
    }
    if (deliveryEmail && deliveryEmail.trim() !== deliveryEmailConfirmation.trim()) {
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
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          productId: product?.id,
          quantity,
          deliveryPhone: deliveryPhone.trim(),
          deliveryPhoneConfirmation: deliveryPhoneConfirmation.trim(),
          deliveryEmail: deliveryEmail.trim() || undefined,
          deliveryEmailConfirmation: deliveryEmailConfirmation.trim() || undefined,
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
      setError(err instanceof Error ? err.message : "The order could not be reserved")
    } finally {
      setPending(false)
    }
  }

  function openPaystackCheckout() {
    if (order?.payment.accessCode && window.PaystackPop) {
      const popup = new window.PaystackPop()
      popup.resumeTransaction(order.payment.accessCode)
    } else {
      handleReserveOrder()
    }
  }

  async function verifyPaymentManually() {
    if (!order) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/checkout/${webSalesId}/${order.orderReference}`,
        { method: "POST" }
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
      if (["SUCCESS", "RECONCILING"].includes(updatedStatus.paymentState)) {
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

  async function copyToClipboard(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1800)
    } catch {
      setError("Please copy manually.")
    }
  }

  const isPaid = status && ["SUCCESS", "RECONCILING"].includes(status.paymentState)
  const isComplete = status && status.fulfillmentState === "DELIVERED"

  return (
    <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if (!val) handleReset() }}>
      <DialogPopup className="max-w-xl p-0 overflow-hidden rounded-3xl border-border/80 bg-background shadow-2xl">
        {/* Step Indicator Header */}
        <div className="border-b bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HugeiconsIcon icon={SecurityCheckIcon} className="size-4" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Secure Checkout
                </p>
                <p className="font-heading text-base font-bold text-foreground">
                  {product?.name || "Results Checker"}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
              Step {step} of 3
            </Badge>
          </div>

          {/* Progressive Progress Bar */}
          <div className="mt-4 flex items-center gap-2">
            <div className={`h-1.5 flex-1 rounded-full transition-all ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
            <div className={`h-1.5 flex-1 rounded-full transition-all ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
            <div className={`h-1.5 flex-1 rounded-full transition-all ${step >= 3 ? "bg-emerald-600" : "bg-muted"}`} />
          </div>
        </div>

        <div className="p-6">
          {error && (
            <Alert variant="destructive" className="mb-4 py-3">
              <AlertTitle className="text-xs font-semibold">Action required</AlertTitle>
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {/* STEP 1: Product & Delivery Info */}
          {step === 1 && (
            <form onSubmit={handleNextToPayment} className="space-y-5">
              <FieldSet>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="modal-product" className="font-semibold">
                      Select Checker Product
                    </FieldLabel>
                    <NativeSelect
                      id="modal-product"
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      className="w-full h-11 text-sm font-medium"
                    >
                      {products.map((item) => (
                        <NativeSelectOption key={item.id} value={item.id}>
                          {item.name} — {money(item.retailPriceMinor, item.currency)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <FieldDescription className="text-xs">{product?.scopeDisclosure}</FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel className="font-semibold">Quantity</FieldLabel>
                    <ToggleGroup
                      value={[String(quantity)]}
                      onValueChange={(values) => {
                        const selected = Number(values[0])
                        if (selected >= 1 && selected <= 5) setQuantity(selected)
                      }}
                      variant="outline"
                      className="justify-start gap-2"
                    >
                      {[1, 2, 3, 4, 5].map((val) => (
                        <ToggleGroupItem
                          key={val}
                          value={String(val)}
                          className="h-10 w-12 font-mono font-bold"
                        >
                          {val}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </Field>
                </FieldGroup>
              </FieldSet>

              <div className="rounded-2xl border bg-muted/20 p-4 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <HugeiconsIcon icon={SecurityCheckIcon} className="size-4 text-primary" />
                  SMS & Digital Delivery Info
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="m-phone" className="text-xs">
                      Delivery Phone (Required)
                    </FieldLabel>
                    <Input
                      id="m-phone"
                      type="tel"
                      placeholder="024 123 4567"
                      value={deliveryPhone}
                      onChange={(e) => setDeliveryPhone(e.target.value)}
                      required
                      className="h-10 text-sm"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="m-phone-confirm" className="text-xs">
                      Confirm Delivery Phone
                    </FieldLabel>
                    <Input
                      id="m-phone-confirm"
                      type="tel"
                      placeholder="Enter phone again"
                      value={deliveryPhoneConfirmation}
                      onChange={(e) => setDeliveryPhoneConfirmation(e.target.value)}
                      required
                      className="h-10 text-sm"
                    />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="m-email" className="text-xs">
                      Email Address (Optional)
                    </FieldLabel>
                    <Input
                      id="m-email"
                      type="email"
                      placeholder="you@example.com"
                      value={deliveryEmail}
                      onChange={(e) => setDeliveryEmail(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="m-email-confirm" className="text-xs">
                      Confirm Email
                    </FieldLabel>
                    <Input
                      id="m-email-confirm"
                      type="email"
                      placeholder="Enter email again"
                      value={deliveryEmailConfirmation}
                      onChange={(e) => setDeliveryEmailConfirmation(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </Field>
                </div>
              </div>

              {/* Total Calculation Row */}
              <div className="flex items-center justify-between rounded-xl bg-primary/10 p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Order Total ({quantity}x)</p>
                  <p className="font-heading text-2xl font-bold text-primary">
                    {product ? money(product.retailPriceMinor * quantity, product.currency) : "—"}
                  </p>
                </div>
                <Button type="submit" size="lg" className="gap-2 font-semibold shadow-md">
                  Continue to Payment
                  <HugeiconsIcon icon={ArrowRight02Icon} className="size-4" />
                </Button>
              </div>
            </form>
          )}

          {/* STEP 2: Order Summary & Paystack Payment */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="rounded-2xl border bg-card p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Order Item</p>
                    <p className="font-heading text-lg font-bold">{quantity}× {product?.name}</p>
                  </div>
                  <Badge variant="secondary" className="font-mono text-sm">
                    {product ? money(product.retailPriceMinor * quantity, product.currency) : "—"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Delivery SMS Phone</span>
                    <p className="font-medium font-mono text-foreground mt-0.5">{deliveryPhone}</p>
                  </div>
                  {deliveryEmail && (
                    <div>
                      <span className="text-muted-foreground">Email Confirmation</span>
                      <p className="font-medium font-mono text-foreground mt-0.5">{deliveryEmail}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3">
                <HugeiconsIcon icon={SecurityCheckIcon} className="size-5 text-emerald-600 shrink-0" />
                <div className="text-xs leading-relaxed text-emerald-900 dark:text-emerald-300">
                  <p className="font-semibold">Instant Mobile Money Checkout</p>
                  <p className="opacity-90">Pay with MTN MoMo, Telecel, or AirtelTigo. Checkers are delivered immediately after payment confirmation.</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={pending}
                  className="gap-2"
                >
                  <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4" />
                  Back
                </Button>

                <Button
                  type="button"
                  onClick={order ? openPaystackCheckout : handleReserveOrder}
                  disabled={pending}
                  size="lg"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-lg"
                >
                  {pending ? (
                    <Spinner className="size-4 text-white" />
                  ) : (
                    <HugeiconsIcon icon={CreditCardIcon} className="size-5" />
                  )}
                  {pending
                    ? "Processing Order…"
                    : order
                      ? "Pay Now"
                      : "Proceed to Payment"}
                </Button>
              </div>

              {order && !isPaid && (
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={verifyPaymentManually}
                    disabled={pending}
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                  >
                    Already paid? Click here to verify status manually ↻
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Instant Voucher Code Delivery View */}
          {step === 3 && (
            <div className="space-y-5 text-center py-2">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 animate-bounce">
                <HugeiconsIcon icon={SparklesIcon} className="size-8" />
              </div>

              <div>
                <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                  Payment Confirmed!
                </Badge>
                <h3 className="font-heading text-2xl font-bold text-foreground mt-2">
                  Here Are Your Checker Codes
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Sent via SMS to <strong className="text-foreground">{deliveryPhone || order?.deliveryPhoneMask}</strong>
                </p>
              </div>

              {isComplete && status?.delivery?.channels ? (
                <div className="space-y-3 text-left">
                  {status.delivery.channels.map((channelStr, idx) => {
                    const parts = channelStr.split(":")
                    const serial = parts[0] ?? ""
                    const pin = parts[1] ?? ""

                    return (
                      <div key={idx} className="rounded-2xl border bg-card p-4 space-y-3 shadow-xs">
                        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                          <span>Voucher {idx + 1} of {status.delivery.total}</span>
                          <span className="text-emerald-600 font-bold">{product?.name}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border bg-muted/30 p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Serial Number
                            </span>
                            <div className="mt-1 flex items-center justify-between">
                              <span className="font-mono text-sm font-bold text-foreground break-all">{serial}</span>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(serial, `s-${idx}`)}
                              >
                                <HugeiconsIcon
                                  icon={copiedKey === `s-${idx}` ? Tick02Icon : Copy01Icon}
                                  className="size-4"
                                />
                              </Button>
                            </div>
                          </div>

                          <div className="rounded-xl border bg-muted/30 p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              PIN
                            </span>
                            <div className="mt-1 flex items-center justify-between">
                              <span className="font-mono text-sm font-bold text-emerald-600 break-all">{pin}</span>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(pin, `p-${idx}`)}
                              >
                                <HugeiconsIcon
                                  icon={copiedKey === `p-${idx}` ? Tick02Icon : Copy01Icon}
                                  className="size-4"
                                />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-6 text-center space-y-3">
                  <Spinner className="mx-auto size-8 text-emerald-600" />
                  <p className="text-sm font-semibold">Allocating your checker PINs…</p>
                  <p className="text-xs text-muted-foreground">Your vouchers are being fetched securely. They will appear here in just a few seconds.</p>
                </div>
              )}

              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-full mt-4"
              >
                Done / Close Checkout
              </Button>
            </div>
          )}
        </div>
      </DialogPopup>
    </Dialog>
  )
}
