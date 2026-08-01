"use client"

import { FormEvent, useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  CreditCardIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
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
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select"
import { Separator } from "@workspace/ui/components/separator"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

export interface StorefrontProduct {
  id: string
  code: string
  name: string
  scopeDisclosure: string
  retailPriceMinor: number
  currency: string
}

interface CreatedOrder {
  orderReference: string
  productName: string
  quantity: number
  currency: string
  totalMinor: number
  deliveryPhoneMask: string
  deliveryEmailMask: string | null
  payerPhoneMask: string
  payerNetwork: string
  payment: { reference: string; state: string }
}

export function StorefrontCheckout({
  webSalesId,
  products,
}: {
  webSalesId: string
  products: StorefrontProduct[]
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "")
  const [quantity, setQuantity] = useState(1)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<CreatedOrder | null>(null)
  const product = useMemo(
    () => products.find((item) => item.id === productId) ?? products[0],
    [productId, products]
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
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
          productId,
          quantity,
          deliveryPhone: String(form.get("deliveryPhone")),
          deliveryPhoneConfirmation: String(
            form.get("deliveryPhoneConfirmation")
          ),
          deliveryEmail: optional(form.get("deliveryEmail")),
          deliveryEmailConfirmation: optional(
            form.get("deliveryEmailConfirmation")
          ),
          payerPhone: String(form.get("payerPhone")),
          payerNetwork: String(form.get("payerNetwork")),
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
            : (message ?? "The order could not be created")
        )
      }
      setOrder(result as CreatedOrder)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The order could not be created"
      )
    } finally {
      setPending(false)
    }
  }

  if (order) {
    return (
      <Card id="checkout">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} />
            Order reserved
          </CardTitle>
          <CardDescription>
            Your checker stock and price are held for this payment attempt.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Alert>
            <HugeiconsIcon icon={InformationCircleIcon} />
            <AlertTitle>Local payment foundation</AlertTitle>
            <AlertDescription>
              No Mobile Money charge has been sent. Paystack authorization is
              the next implementation slice.
            </AlertDescription>
          </Alert>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Summary label="Order reference" value={order.orderReference} />
            <Summary label="Checker" value={order.productName} />
            <Summary label="Quantity" value={String(order.quantity)} />
            <Summary
              label="Total"
              value={money(order.totalMinor, order.currency)}
            />
            <Summary label="SMS delivery" value={order.deliveryPhoneMask} />
            <Summary label="Mobile Money" value={order.payerPhoneMask} />
          </dl>
        </CardContent>
        <CardFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOrder(null)}
          >
            Start another order
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card id="checkout">
      <CardHeader>
        <CardTitle>Complete your order</CardTitle>
        <CardDescription>
          Confirm where the checker should be delivered and which Mobile Money
          account will pay.
        </CardDescription>
      </CardHeader>
      <form onSubmit={submit}>
        <CardContent className="flex flex-col gap-6">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Order not created</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <FieldSet>
            <FieldLegend>Checker and quantity</FieldLegend>
            <FieldDescription>
              Each checker supports three uses and locks to one candidate and
              examination year after its first use.
            </FieldDescription>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="checkout-product">Checker</FieldLabel>
                <NativeSelect
                  className="w-full"
                  id="checkout-product"
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                >
                  {products.map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {item.name} —{" "}
                      {money(item.retailPriceMinor, item.currency)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription>{product?.scopeDisclosure}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel id="quantity-label">Quantity</FieldLabel>
                <ToggleGroup
                  aria-labelledby="quantity-label"
                  value={[String(quantity)]}
                  onValueChange={(values) => {
                    const selected = Number(values[0])
                    if (selected >= 1 && selected <= 5) setQuantity(selected)
                  }}
                  variant="outline"
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <ToggleGroupItem key={value} value={String(value)}>
                      {value}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
            </FieldGroup>
          </FieldSet>

          <Separator />

          <FieldSet>
            <FieldLegend>Secure delivery</FieldLegend>
            <FieldDescription>
              We send every serial number and PIN by SMS. Email is optional.
            </FieldDescription>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <ContactField
                autoComplete="tel"
                id="delivery-phone"
                label="Delivery phone"
                name="deliveryPhone"
                placeholder="024 123 4567"
                type="tel"
              />
              <ContactField
                autoComplete="off"
                id="delivery-phone-confirmation"
                label="Confirm delivery phone"
                name="deliveryPhoneConfirmation"
                placeholder="Enter it again"
                type="tel"
              />
              <ContactField
                autoComplete="email"
                id="delivery-email"
                label="Delivery email (optional)"
                name="deliveryEmail"
                placeholder="you@example.com"
                required={false}
                type="email"
              />
              <ContactField
                autoComplete="off"
                id="delivery-email-confirmation"
                label="Confirm delivery email"
                name="deliveryEmailConfirmation"
                placeholder="Enter it again"
                required={false}
                type="email"
              />
            </FieldGroup>
          </FieldSet>

          <Separator />

          <FieldSet>
            <FieldLegend>Mobile Money payment</FieldLegend>
            <FieldDescription>
              The payer number may be different from the delivery number.
            </FieldDescription>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <ContactField
                autoComplete="tel"
                id="payer-phone"
                label="Mobile Money number"
                name="payerPhone"
                placeholder="024 123 4567"
                type="tel"
              />
              <Field>
                <FieldLabel htmlFor="payer-network">Network</FieldLabel>
                <NativeSelect
                  className="w-full"
                  id="payer-network"
                  name="payerNetwork"
                  required
                >
                  <NativeSelectOption value="mtn">
                    MTN Mobile Money
                  </NativeSelectOption>
                  <NativeSelectOption value="atl">
                    ATMoney / Airtel Money
                  </NativeSelectOption>
                  <NativeSelectOption value="vod">
                    Telecel Cash
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
            </FieldGroup>
          </FieldSet>

          <div className="flex items-end justify-between gap-4 rounded-lg bg-muted p-4">
            <div>
              <p className="text-sm text-muted-foreground">Order total</p>
              <p className="font-heading text-2xl font-semibold">
                {product
                  ? money(product.retailPriceMinor * quantity, product.currency)
                  : "—"}
              </p>
            </div>
            <p className="text-right text-xs text-muted-foreground">
              {quantity} × {product?.name}
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" disabled={pending} size="lg" type="submit">
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <HugeiconsIcon data-icon="inline-start" icon={CreditCardIcon} />
            )}
            {pending ? "Reserving your order…" : "Reserve and continue"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function ContactField({
  id,
  label,
  name,
  required = true,
  ...props
}: {
  id: string
  label: string
  name: string
  required?: boolean
} & React.ComponentProps<typeof Input>) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} name={name} required={required} {...props} />
    </Field>
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

function optional(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim()
  return normalized || undefined
}

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
  }).format(minor / 100)
}
