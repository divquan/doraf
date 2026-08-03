import { redirect } from "next/navigation"
import { ShoppingBag01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { PageHeader } from "@/components/_workspace/page-header"
import { SalesLinkCard } from "@/components/sales-link-card"
import { apiJson, apiRequest } from "@/lib/agent-api"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@workspace/ui/components/empty"

import { buttonVariants } from "@workspace/ui/components/button"

interface AgentSession {
  agent: {
    id: string
    tenantId: string
    name: string
    phoneMask: string
    status: "ACTIVE" | "SUSPENDED"
  }
}

interface SalesChannel {
  publicId: string
  path: string
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

  const salesUrl = new URL(
    channel.path,
    process.env.DORAF_AGENT_WEB_URL ?? "http://localhost:3002"
  ).toString()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="Sales Channels"
        description="Share your customer checkout link and track customer orders."
        actions={
          <a
            href={salesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            View your store
          </a>
        }
      />
      
      <section>
        <SalesLinkCard
          readOnly={agent.status === "SUSPENDED"}
          salesUrl={salesUrl}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Recent Orders</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time history of customer voucher purchases.
          </p>
        </div>
        
        <Empty className="border border-dashed p-10 bg-muted/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={ShoppingBag01Icon} />
            </EmptyMedia>
            <EmptyTitle>Order history is coming soon</EmptyTitle>
            <EmptyDescription>
              Your sales link is active and customer purchases will automatically credit your wallet balance in real time. Order tracking details will be available in a future update.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    </div>
  )
}
