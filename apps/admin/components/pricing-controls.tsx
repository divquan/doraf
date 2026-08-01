"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

interface PricingData {
  viewerRole: "ADMINISTRATOR" | "SUPPORT"
  products: Array<{
    id: string
    code: string
    name: string
    status: string
    policy: null | { basePriceMinor: number; maximumRetailPriceMinor: number }
  }>
  agents: Array<{ id: string; name: string; phoneMask: string; status: string }>
}

export function PricingControls({ data }: { data: PricingData }) {
  if (data.viewerRole === "SUPPORT") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current product pricing</CardTitle>
          <CardDescription>Support access is read-only.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {data.products.map((product) => (
            <div className="rounded-lg border p-4" key={product.id}>
              <p className="font-medium">{product.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {product.policy
                  ? `${money(product.policy.basePriceMinor)} – ${money(product.policy.maximumRetailPriceMinor)}`
                  : "No active policy"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <PricingForm data={data} />
      <OverrideForm data={data} />
    </div>
  )
}

function money(minor: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
  }).format(minor / 100)
}

function PricingForm({ data }: { data: PricingData }) {
  return (
    <OperationForm
      title="Default product pricing"
      description="Set the base price and highest buyer price for a checker. Active agent prices are adjusted automatically."
      endpoint="/api/pricing"
      data={data}
    />
  )
}

function OverrideForm({ data }: { data: PricingData }) {
  return (
    <OperationForm
      title="Agent-specific override"
      description="Override either side of the permitted range for one agent. Leave a price blank to inherit the product default."
      endpoint="/api/pricing/overrides"
      data={data}
      withAgent
    />
  )
}

function OperationForm({
  title,
  description,
  endpoint,
  data,
  withAgent = false,
}: {
  title: string
  description: string
  endpoint: string
  data: PricingData
  withAgent?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    const form = new FormData(event.currentTarget)
    const amount = (name: string) => {
      const value = String(form.get(name) ?? "").trim()
      return value ? Math.round(Number(value) * 100) : undefined
    }
    const body = {
      productId: String(form.get("productId")),
      agentId: withAgent ? String(form.get("agentId")) : undefined,
      basePriceMinor: amount("basePrice"),
      maximumRetailPriceMinor: amount("maximumPrice"),
      effectiveFrom: new Date(String(form.get("effectiveFrom"))).toISOString(),
      reason: String(form.get("reason") ?? "").trim(),
    }
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = (await response.json().catch(() => ({}))) as {
        message?: string
        clampedPriceCount?: number
      }
      if (!response.ok)
        throw new Error(result.message ?? "The change could not be saved")
      setMessage(
        `Saved. ${result.clampedPriceCount ?? 0} active price${result.clampedPriceCount === 1 ? " was" : "s were"} adjusted.`
      )
      router.refresh()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The change could not be saved"
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <SelectField
            label="Checker product"
            name="productId"
            options={data.products.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
          />
          {withAgent ? (
            <SelectField
              label="Agent"
              name="agentId"
              options={data.agents.map((item) => ({
                value: item.id,
                label: `${item.name} · ${item.phoneMask}`,
              }))}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Base price (GHS)"
              name="basePrice"
              type="number"
              required={!withAgent}
            />
            <TextField
              label="Maximum (GHS)"
              name="maximumPrice"
              type="number"
              required={!withAgent}
            />
          </div>
          <TextField
            label="Effective from"
            name="effectiveFrom"
            type="datetime-local"
            required
          />
          <TextField label="Reason" name="reason" required />
          {message ? (
            <p
              className="rounded-md border bg-muted/30 p-3 text-sm"
              role="status"
            >
              {message}
            </p>
          ) : null}
          <Button disabled={pending} type="submit">
            {pending ? "Saving…" : "Review and apply"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function TextField({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? "0" : undefined}
        required={required}
      />
    </div>
  )
}

function SelectField({
  label,
  name,
  options,
}: {
  label: string
  name: string
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        id={name}
        name={name}
        required
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
