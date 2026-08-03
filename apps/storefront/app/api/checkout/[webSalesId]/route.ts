import { NextRequest } from "next/server"
import {
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
} from "@/lib/agent-api"

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/checkout/[webSalesId]">
) {
  try {
    requireSameOrigin(request)
    const { webSalesId } = await context.params
    const body: unknown = await request.json()
    const idempotencyKey = request.headers.get("idempotency-key")
    const response = await apiRequest(
      `/sales-channels/web/${encodeURIComponent(webSalesId)}/orders`,
      {
        method: "POST",
        headers: idempotencyKey
          ? { "idempotency-key": idempotencyKey }
          : undefined,
        body: JSON.stringify(body),
      }
    )
    const result: unknown = await response.json().catch(() => ({}))
    return noStoreJson(result, { status: response.status })
  } catch (error) {
    return routeError(error, "The order could not be created")
  }
}
