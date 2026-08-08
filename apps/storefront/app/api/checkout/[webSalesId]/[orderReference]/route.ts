import { NextRequest } from "next/server"
import {
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
} from "@/lib/agent-api"

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/checkout/[webSalesId]/[orderReference]">
) {
  try {
    requireSameOrigin(request)
    const { webSalesId, orderReference } = await context.params
    const checkoutToken = request.headers.get("x-checkout-token")
    const response = await apiRequest(
      `/sales-channels/web/${encodeURIComponent(webSalesId)}/orders/${encodeURIComponent(orderReference)}`,
      {
        method: "GET",
        headers: checkoutToken
          ? { "x-checkout-token": checkoutToken }
          : undefined,
      }
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
    const checkoutToken = request.headers.get("x-checkout-token")
    const paymentReference = request.headers.get("x-payment-reference")
    const response = await apiRequest(
      `/sales-channels/web/${encodeURIComponent(webSalesId)}/orders/${encodeURIComponent(orderReference)}/verify`,
      {
        method: "POST",
        headers: {
          ...(checkoutToken ? { "x-checkout-token": checkoutToken } : {}),
          ...(paymentReference
            ? { "x-payment-reference": paymentReference }
            : {}),
        },
      }
    )
    const result: unknown = await response.json().catch(() => ({}))
    return noStoreJson(result, { status: response.status })
  } catch (error) {
    return routeError(error, "The payment result could not be verified")
  }
}
