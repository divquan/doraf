import { redirect } from "next/navigation"
import { PageHeader } from "@/components/_workspace/page-header"
import {
  AgentOrderItem,
  AgentOrdersTable,
  OrderPagination,
} from "@/components/agent-orders-table"
import { apiJson, apiRequest } from "@/lib/internal-api"

const MAX_ORDERS_PAGE = 10_000

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const query = await searchParams
  const page = getOrdersPage(query.page)
  const response = await apiRequest(`/admin/orders?page=${page}`, {}, true)

  if (response.status === 401) {
    redirect("/login")
  }
  if (response.status === 403) {
    redirect("/dashboard")
  }

  const data = (await apiJson(response)) as {
    items: AgentOrderItem[]
    pagination: OrderPagination
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <PageHeader
        title="Orders"
        description="All recorded orders across every agent, with persisted payment and delivery status."
      />
      <section>
        <AgentOrdersTable
          description="Delivery is read from persisted delivery messages. Delivered appears only when every recorded delivery message is marked delivered."
          items={data.items}
          pagination={data.pagination}
          showAgent
          title="All orders"
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
