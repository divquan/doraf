import { redirect } from "next/navigation"
import { ShoppingBag01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { PageHeader } from "@/components/_workspace/page-header"
import { StoreEditor, type StorefrontData } from "@/components/store-editor"
import { type AgentPricingRow } from "@/components/pricing-grid"
import { apiJson, apiRequest } from "@/lib/agent-api"
import { qrDataUrl } from "@/lib/qr"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@workspace/ui/components/empty"

interface AgentSession {
  agent: {
    id: string
    tenantId: string
    name: string
    phoneMask: string
    status: "ACTIVE" | "SUSPENDED"
  }
}

interface SalesChannel extends StorefrontData {
  type: "WEB"
}

export default async function MyStorePage() {
  const [sessionRes, channelRes, pricesRes] = await Promise.all([
    apiRequest("/agent-auth/session", {}, true),
    apiRequest("/agent-auth/sales-channel", {}, true),
    apiRequest("/agent-auth/prices", {}, true),
  ])

  if (sessionRes.status === 401) {
    redirect("/login")
  }

  const { agent } = (await apiJson(sessionRes)) as AgentSession
  const channel = (await apiJson(channelRes)) as SalesChannel
  const prices = pricesRes.ok ? ((await apiJson(pricesRes)) as AgentPricingRow[]) : []

  const salesUrl = channel.subdomainUrl
  const qr = await qrDataUrl(salesUrl)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="My Store"
        description="Customize your storefront and share your store link to sell checkers."
      />

      <StoreEditor
        initialData={channel}
        products={prices}
        readOnly={agent.status === "SUSPENDED"}
        qrDataUrl={qr}
      />

      {/* Recent Orders Section */}
      <section className="space-y-4">
        <div>
          <h2 className="font-heading text-2xl font-semibold">
            Recent Orders
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time history of customer voucher purchases.
          </p>
        </div>

        <Empty className="border border-dashed bg-muted/10 p-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={ShoppingBag01Icon} />
            </EmptyMedia>
            <EmptyTitle>Order history is coming soon</EmptyTitle>
            <EmptyDescription>
              Your sales link is active and customer purchases will
              automatically credit your wallet balance in real time. Order
              tracking details will be available in a future update.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    </div>
  )
}
