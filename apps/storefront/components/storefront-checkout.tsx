"use client"

import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { CheckoutForm } from "./_storefront/checkout-form"
import { CheckoutStatus } from "./_storefront/checkout-status"

declare global {
  interface Window {
    PaystackPop?: new () => {
      resumeTransaction(accessCode: string): void
    }
  }
}

export interface StorefrontProduct {
  id: string
  code: string
  name: string
  scopeDisclosure: string
  retailPriceMinor: number
  currency: string
}

export interface CreatedOrder {
  orderReference: string
  productName: string
  quantity: number
  currency: string
  totalMinor: number
  deliveryPhoneMask: string
  deliveryEmailMask: string | null
  payment: PaymentStatus
}

interface PaymentStatus {
  reference: string
  state: string
  providerStatus: string | null
  displayText: string | null
  authorizationExpiresAt: string
  accessCode?: string
}

export interface OrderStatus {
  orderReference: string
  paymentState: string
  fulfillmentState: string
  payment: PaymentStatus | null
  delivery: {
    total: number
    pending: number
    delivered: number
    channels: string[]
  }
}

export function StorefrontCheckout({
  webSalesId,
  products,
}: {
  webSalesId: string
  products: StorefrontProduct[]
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<CreatedOrder | null>(null)
  const [status, setStatus] = useState<OrderStatus | null>(null)

  useEffect(() => {
    if (!order) return
    const orderReference = order.orderReference
    let cancelled = false
    async function refresh() {
      try {
        const response = await fetch(
          `/api/checkout/${webSalesId}/${orderReference}`,
          { cache: "no-store" }
        )
        if (!response.ok) return
        const next = (await response.json()) as OrderStatus
        if (!cancelled) setStatus(next)
      } catch {
        // A transient status request must not discard the confirmed order.
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 3_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [order, webSalesId])

  function openPaystackCheckout(accessCode: string) {
    if (!accessCode || !window.PaystackPop) {
      setError(
        "Secure checkout is still loading. Please try again in a moment."
      )
      return
    }
    const popup = new window.PaystackPop()
    popup.resumeTransaction(accessCode)
  }

  async function verifyPayment() {
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
      setStatus(result as OrderStatus)
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

  function handleStartOver() {
    setOrder(null)
    setStatus(null)
    setError(null)
  }

  return (
    <>
      {error ? (
        <Alert className="mb-5" variant="destructive">
          <AlertTitle>Checkout error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!order ? (
        <CheckoutForm
          webSalesId={webSalesId}
          products={products}
          onOrderReserved={setOrder}
          pending={pending}
          setPending={setPending}
          error={error}
          setError={setError}
        />
      ) : (
        <CheckoutStatus
          webSalesId={webSalesId}
          order={order}
          status={status}
          pending={pending}
          openPaystackCheckout={openPaystackCheckout}
          verifyPayment={verifyPayment}
          onStartOver={handleStartOver}
        />
      )}
    </>
  )
}
