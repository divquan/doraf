import { NextRequest } from "next/server"
import {
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
} from "@/lib/agent-api"

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/checkout/[webSalesId]/[orderReference]/local-payment">
) {
  try {
    requireSameOrigin(request)
    const { webSalesId, orderReference } = await context.params
    const response = await apiRequest(
      `/sales-channels/web/${encodeURIComponent(webSalesId)}/orders/${encodeURIComponent(orderReference)}/payments/local/complete`,
      { method: "POST" }
    )
    const result: unknown = await response.json().catch(() => ({}))
    return noStoreJson(result, { status: response.status })
  } catch (error) {
    return routeError(error, "The local payment could not be completed")
  }
}
