import { NextRequest } from "next/server"
import {
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
} from "@/lib/agent-api"

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/checkout/[webSalesId]/[orderReference]/reveal">
) {
  try {
    requireSameOrigin(request)
    const { webSalesId, orderReference } = await context.params
    const checkoutToken = request.headers.get("x-checkout-token")
    const response = await apiRequest(
      `/sales-channels/web/${encodeURIComponent(webSalesId)}/orders/${encodeURIComponent(orderReference)}/reveal`,
      {
        method: "POST",
        headers: checkoutToken
          ? { "x-checkout-token": checkoutToken }
          : undefined,
      }
    )
    const result: unknown = await response.json().catch(() => ({}))
    return noStoreJson(result, { status: response.status })
  } catch (error) {
    return routeError(error, "The voucher codes could not be loaded")
  }
}
