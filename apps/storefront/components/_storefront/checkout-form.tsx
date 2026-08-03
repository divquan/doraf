"use client"

import { FormEvent, useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CreditCardIcon } from "@hugeicons/core-free-icons"
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
import { money } from "@workspace/ui/lib/format"
import { type StorefrontProduct, type CreatedOrder } from "../storefront-checkout"

export function CheckoutForm({
  webSalesId,
  products,
  onOrderReserved,
  pending,
  setPending,
  error,
  setError,
}: {
  webSalesId: string
  products: StorefrontProduct[]
  onOrderReserved: (order: CreatedOrder) => void
  pending: boolean
  setPending: (pending: boolean) => void
  error: string | null
  setError: (error: string | null) => void
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "")
  const [quantity, setQuantity] = useState(1)

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
      onOrderReserved(result as CreatedOrder)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The order could not be reserved"
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="overflow-hidden border-border/75 shadow-sm" id="checkout">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-xl">Checkout</CardTitle>
        <CardDescription>
          Reserve your results checker vouchers instantly.
        </CardDescription>
      </CardHeader>
      <form onSubmit={submit}>
        <CardContent className="space-y-6 pt-6">
          <FieldSet>
            <FieldLegend>Product configuration</FieldLegend>
            <FieldDescription>
              Vouchers are allocated immediately. Your checker PIN will work for any
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
                      {item.name} — {money(item.retailPriceMinor, item.currency)}
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

function optional(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim()
  return normalized || undefined
}
