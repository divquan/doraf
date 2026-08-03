"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  Copy01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"
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
import { Separator } from "@workspace/ui/components/separator"
import { Spinner } from "@workspace/ui/components/spinner"
import { money } from "@workspace/ui/lib/format"
import { type CreatedOrder, type OrderStatus } from "../storefront-checkout"

export function CheckoutStatus({
  webSalesId,
  order,
  status,
  pending,
  openPaystackCheckout,
  verifyPayment,
  onStartOver,
}: {
  webSalesId: string
  order: CreatedOrder
  status: OrderStatus | null
  pending: boolean
  openPaystackCheckout: (accessCode: string) => void
  verifyPayment: () => void
  onStartOver: () => void
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      window.setTimeout(() => setCopied(null), 1_500)
    } catch {
      setError("Your browser could not copy that value. Select it manually.")
    }
  }

  const paymentState = status?.paymentState ?? order.payment.state
  const fulfillmentState = status?.fulfillmentState ?? "PENDING"
  const isPaid = ["SUCCESS", "RECONCILING"].includes(paymentState)
  const isFulfilling = isPaid && fulfillmentState === "PENDING"
  const isComplete = isPaid && fulfillmentState === "DELIVERED"
  const isFailed = ["FAILED", "ABANDONED"].includes(paymentState)

  const activePayment = status?.payment ?? order.payment

  return (
    <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start" id="checkout">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Order status</CardTitle>
          <CardDescription>
            Reference: <span className="font-mono">{order.orderReference}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Summary
            label="Product"
            value={`${order.quantity} × ${order.productName}`}
          />
          <Summary
            label="Amount to pay"
            value={money(order.totalMinor, order.currency)}
          />
          <Summary
            label="SMS delivery phone"
            value={order.deliveryPhoneMask}
          />
          {order.deliveryEmailMask ? (
            <Summary
              label="Email delivery"
              value={order.deliveryEmailMask}
            />
          ) : null}

          <Separator />

          <div>
            <span className="text-sm text-muted-foreground">Payment</span>
            <div className="mt-1.5 flex items-center gap-2.5">
              <span className="text-base font-semibold">
                {paymentLabel(paymentState)}
              </span>
              {isPaid ? (
                <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 hover:bg-emerald-500/10">
                  Confirmed
                </Badge>
              ) : isFailed ? (
                <Badge variant="destructive">Failed</Badge>
              ) : (
                <Badge variant="outline" className="animate-pulse">
                  Awaiting payment
                </Badge>
              )}
            </div>
            {activePayment.displayText ? (
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {activePayment.displayText}
              </p>
            ) : null}
          </div>

          <Separator />

          <div>
            <span className="text-sm text-muted-foreground">Delivery</span>
            <div className="mt-1.5 flex items-center gap-2.5">
              <span className="text-base font-semibold">
                {isComplete
                  ? "Delivered"
                  : isFulfilling
                    ? "Allocating checkers"
                    : "Awaiting payment"}
              </span>
              {isComplete ? (
                <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 hover:bg-emerald-500/10">
                  Completed
                </Badge>
              ) : isFulfilling ? (
                <Badge variant="outline" className="animate-pulse">
                  Processing
                </Badge>
              ) : (
                <Badge variant="outline">Pending</Badge>
              )}
            </div>
            {isFulfilling ? (
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Payment received! We are reserving your unique checkers. They will
                be sent via SMS and displayed here in a few seconds.
              </p>
            ) : null}
          </div>
        </CardContent>
        {!isPaid && !isFailed ? (
          <CardFooter className="flex-col gap-3 border-t bg-muted/15 pt-4">
            {activePayment.accessCode ? (
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => openPaystackCheckout(activePayment.accessCode!)}
                size="lg"
                type="button"
              >
                Pay now
              </Button>
            ) : null}
            <Button
              className="w-full"
              disabled={pending}
              onClick={verifyPayment}
              variant="outline"
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "Checking status…" : "Check status manually"}
            </Button>
          </CardFooter>
        ) : null}
        {isFailed ? (
          <CardFooter className="border-t bg-muted/15 pt-4">
            <Button className="w-full" onClick={onStartOver} type="button">
              Try checkout again
            </Button>
          </CardFooter>
        ) : null}
      </Card>
      
      <div>
        {isComplete && status?.delivery ? (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-sm leading-6">
              <h3 className="font-heading text-lg font-semibold text-emerald-800 dark:text-emerald-300">
                Delivery complete
              </h3>
              <p className="mt-2 text-muted-foreground">
                We have successfully allocated {status.delivery.total}{" "}
                {status.delivery.total === 1 ? "checker" : "checkers"} and
                delivered them to <span className="font-semibold">{order.deliveryPhoneMask}</span>.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {status.delivery.channels.map((channelStr, index) => {
                const parts = channelStr.split(":")
                const serial = parts[0] ?? ""
                const pin = parts[1] ?? ""
                return (
                  <div
                    className="rounded-xl border bg-muted/25 p-4"
                    key={index}
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="font-medium">Checker {index + 1}</p>
                      <Badge variant="secondary">{order.productName}</Badge>
                    </div>
                    <dl className="grid gap-4 sm:grid-cols-2">
                      <Secret
                        copied={copied === `serial-${index}`}
                        label="Serial number"
                        onCopy={() => void copy(serial, `serial-${index}`)}
                        value={serial}
                      />
                      <Secret
                        copied={copied === `pin-${index}`}
                        label="PIN"
                        onCopy={() => void copy(pin, `pin-${index}`)}
                        value={pin}
                      />
                    </dl>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <Card className="border-dashed flex items-center justify-center p-10 min-h-[300px] text-center">
            <div className="max-w-sm space-y-3">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={1.8} />
              </div>
              <h3 className="font-heading text-lg font-semibold">
                Allocation pending
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Once payment is confirmed, your checkers will be instantly
                generated and shown right here.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function Secret({
  copied,
  label,
  onCopy,
  value,
}: {
  copied: boolean
  label: string
  onCopy: () => void
  value: string
}) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 flex items-center justify-between gap-2">
        <span className="min-w-0 font-mono text-base font-semibold break-all">
          {value}
        </span>
        <Button
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={onCopy}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {copied ? (
            <HugeiconsIcon icon={CheckmarkCircle02Icon} />
          ) : (
            <HugeiconsIcon icon={Copy01Icon} />
          )}
        </Button>
      </dd>
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}

function paymentLabel(state: string) {
  const labels: Record<string, string> = {
    CREATED: "Preparing payment",
    PENDING_AUTHORIZATION: "Awaiting authorization",
    VERIFYING: "Verifying",
    RECONCILING: "Confirming result",
    SUCCESS: "Paid",
    FAILED: "Failed",
    ABANDONED: "Expired",
  }
  return labels[state] ?? "Processing"
}
