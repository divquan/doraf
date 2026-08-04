import { redirect } from "next/navigation"
import { ShoppingBag01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { PageHeader } from "@/components/_workspace/page-header"
import { SalesLinkCard } from "@/components/sales-link-card"
import {
  StorefrontSettingsCard,
  type StorefrontSettings,
} from "@/components/storefront-settings-card"
import { apiJson, apiRequest } from "@/lib/agent-api"
import { qrDataUrl } from "@/lib/qr"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@workspace/ui/components/empty"
import { Card } from "@workspace/ui/components/card"

interface AgentSession {
  agent: {
    id: string
    tenantId: string
    name: string
    phoneMask: string
    status: "ACTIVE" | "SUSPENDED"
  }
}

interface SalesChannel extends StorefrontSettings {
  type: "WEB"
}

export default async function SalesPage() {
  const [sessionRes, channelRes] = await Promise.all([
    apiRequest("/agent-auth/session", {}, true),
    apiRequest("/agent-auth/sales-channel", {}, true),
  ])

  if (sessionRes.status === 401) {
    redirect("/login")
  }

  const { agent } = (await apiJson(sessionRes)) as AgentSession
  const channel = (await apiJson(channelRes)) as SalesChannel

  const publicId = channel.slug || channel.webSalesId
  const salesUrl =
    channel.subdomainUrl || `https://${publicId}.doraf.app`
  const qr = await qrDataUrl(salesUrl)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="My Store"
        description="Share your link to sell checkers."
      />

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
        {/* Left Column: Store Link & Customization & Orders */}
        <div className="space-y-8 lg:col-span-2">
          <section>
            <SalesLinkCard
              readOnly={agent.status === "SUSPENDED"}
              salesUrl={salesUrl}
              qrDataUrl={qr}
            />
          </section>

          <section>
            <StorefrontSettingsCard
              readOnly={agent.status === "SUSPENDED"}
              initialSettings={channel}
            />
          </section>

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

        {/* Right Column: How it Works */}
        <div className="lg:pl-4">
          <Card className="space-y-4 border-border/75 bg-card p-5 text-card-foreground shadow-sm">
            <h3 className="border-b pb-2 font-heading text-lg font-semibold text-foreground">
              How it Works
            </h3>
            <ol className="list-none space-y-4 pl-0 text-sm leading-relaxed text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">
                  1
                </span>
                <div>
                  <p className="font-semibold text-foreground">
                    Share Your Link
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Copy your store link and share it on WhatsApp, Facebook, or
                    SMS.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">
                  2
                </span>
                <div>
                  <p className="font-semibold text-foreground">
                    Customer Pays via MoMo
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Customers pay securely with MTN MoMo, Telecel, AT, or Cards
                    and receive results immediately.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">
                  3
                </span>
                <div>
                  <p className="font-semibold text-foreground">
                    You Earn Instantly
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Your wallet balance is credited with the profit difference
                    automatically.
                  </p>
                </div>
              </li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  )
}
