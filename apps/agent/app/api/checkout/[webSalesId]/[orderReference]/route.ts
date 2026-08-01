import { NextRequest } from "next/server"
import {
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
} from "@/lib/agent-api"

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/checkout/[webSalesId]/[orderReference]">
) {
  try {
    const { webSalesId, orderReference } = await context.params
    const response = await apiRequest(
      `/sales-channels/web/${encodeURIComponent(webSalesId)}/orders/${encodeURIComponent(orderReference)}`
    )
    const result: unknown = await response.json().catch(() => ({}))
    return noStoreJson(result, { status: response.status })
  } catch (error) {
    return routeError(error, "The order status could not be loaded")
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/checkout/[webSalesId]/[orderReference]">
) {
  try {
    requireSameOrigin(request)
    const { webSalesId, orderReference } = await context.params
    const response = await apiRequest(
      `/sales-channels/web/${encodeURIComponent(webSalesId)}/orders/${encodeURIComponent(orderReference)}/verify`,
      { method: "POST" }
    )
    const result: unknown = await response.json().catch(() => ({}))
    return noStoreJson(result, { status: response.status })
  } catch (error) {
    return routeError(error, "The payment result could not be verified")
  }
}
