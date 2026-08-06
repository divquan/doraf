import { redirect } from "next/navigation"
import { PageHeader } from "@/components/_workspace/page-header"
import { type StorefrontData } from "@/components/store-editor"
import { type AgentPricingRow } from "@/components/pricing-grid"
import { type AgentOrderItem } from "@/components/_workspace/recent-orders-table"
import { MyStoreTabPanel } from "@/components/_workspace/my-store-tab-panel"
import { type PaginationMetadata } from "@/components/transaction-history-table"
import { apiJson, apiRequest } from "@/lib/agent-api"
import { qrDataUrl } from "@/lib/qr"

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

interface PaginatedOrdersResponse {
  items: AgentOrderItem[]
  pagination: PaginationMetadata
}

export default async function MyStorePage(props: {
  searchParams?: Promise<{ ordersPage?: string }>
}) {
  const searchParams = await props.searchParams
  const ordersPage = searchParams?.ordersPage ?? "1"

  const [sessionRes, channelRes, pricesRes, ordersRes] = await Promise.all([
    apiRequest("/agent-auth/session", {}, true),
    apiRequest("/agent-auth/sales-channel", {}, true),
    apiRequest("/agent-auth/prices", {}, true),
    apiRequest(`/agent-auth/orders?page=${ordersPage}`, {}, true),
  ])

  if (sessionRes.status === 401) {
    redirect("/login")
  }

  const { agent } = (await apiJson(sessionRes)) as AgentSession
  const channel = (await apiJson(channelRes)) as SalesChannel
  const prices = pricesRes.ok ? ((await apiJson(pricesRes)) as AgentPricingRow[]) : []

  const ordersData = ordersRes.ok
    ? ((await apiJson(ordersRes)) as PaginatedOrdersResponse)
    : { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 10, hasNextPage: false } }

  const salesUrl = channel.subdomainUrl
  const qr = await qrDataUrl(salesUrl)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="My Store"
        description="Customize your storefront and share your store link to sell checkers."
      />

      <MyStoreTabPanel
        channel={channel}
        prices={prices}
        readOnly={agent.status === "SUSPENDED"}
        qrDataUrl={qr}
        orders={ordersData.items}
        ordersPagination={ordersData.pagination}
        initialTab={searchParams?.ordersPage ? "orders" : "store"}
      />
    </div>
  )
}
