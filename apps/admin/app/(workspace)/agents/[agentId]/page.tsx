import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Badge } from "@workspace/ui/components/badge"
import {
  AgentOrderItem,
  AgentOrdersTable,
  OrderPagination,
} from "@/components/agent-orders-table"
import {
  AgentSalesSummary,
  AgentSalesSummaryGrid,
} from "@/components/agent-sales-summary"
import { AgentPricingOverrides } from "@/components/agent-pricing-overrides"
import { ApiError, apiJson, apiRequest } from "@/lib/internal-api"
import type { AgentPricingOverridesData } from "@/lib/pricing"

const MAX_ORDERS_PAGE = 10_000

interface AgentIdentity {
  id: string
  name: string
  phoneMask: string
  status: "ACTIVE" | "SUSPENDED"
  createdAt: string
}

export default async function AgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const { agentId } = await params
  const query = await searchParams
  const page = getOrdersPage(query.page)

  const [identityRes, summaryRes, ordersRes, pricingRes] = await Promise.all([
    apiRequest(`/admin/agents/${encodeURIComponent(agentId)}`, {}, true),
    apiRequest(
      `/admin/agents/${encodeURIComponent(agentId)}/summary`,
      {},
      true
    ),
    apiRequest(
      `/admin/agents/${encodeURIComponent(agentId)}/orders?page=${page}`,
      {},
      true
    ),
    apiRequest(
      `/admin/agents/${encodeURIComponent(agentId)}/pricing-overrides`,
      {},
      true
    ),
  ])

  if (identityRes.status === 401) {
    redirect("/login")
  }
  if (identityRes.status === 403) {
    redirect("/dashboard")
  }

  let identity: AgentIdentity
  let summary: AgentSalesSummary
  let ordersData: { items: AgentOrderItem[]; pagination: OrderPagination }
  let pricingData: AgentPricingOverridesData
  try {
    identity = (await apiJson(identityRes)) as AgentIdentity
    summary = (await apiJson(summaryRes)) as AgentSalesSummary
    ordersData = (await apiJson(ordersRes)) as {
      items: AgentOrderItem[]
      pagination: OrderPagination
    }
    pricingData = (await apiJson(pricingRes)) as AgentPricingOverridesData
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          href="/agents"
        >
          ← Back to agents
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {identity.name}
          </h1>
          <Badge
            variant={identity.status === "ACTIVE" ? "secondary" : "destructive"}
          >
            {identity.status === "ACTIVE" ? "Active" : "Suspended"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{identity.phoneMask}</p>
      </header>

      <section>
        <AgentSalesSummaryGrid summary={summary} />
      </section>

      <section>
        <AgentPricingOverrides agentId={agentId} data={pricingData} />
      </section>

      <section>
        <AgentOrdersTable
          agentId={agentId}
          items={ordersData.items}
          pagination={ordersData.pagination}
        />
      </section>
    </div>
  )
}

function getOrdersPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || !/^[1-9]\d*$/.test(raw)) return 1
  const parsed = Number(raw)
  if (!Number.isSafeInteger(parsed)) return MAX_ORDERS_PAGE
  return Math.min(parsed, MAX_ORDERS_PAGE)
}
