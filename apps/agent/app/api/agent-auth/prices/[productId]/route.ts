import { randomUUID } from "node:crypto"
import { NextRequest } from "next/server"
import {
  apiJson,
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
} from "@/lib/agent-api"

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/agent-auth/prices/[productId]">
) {
  try {
    requireSameOrigin(request)
    const { productId } = await context.params
    const body = await request.json()
    const response = await apiRequest(
      `/agent-auth/prices/${encodeURIComponent(productId)}`,
      {
        method: "POST",
        headers: { "idempotency-key": randomUUID() },
        body: JSON.stringify(body),
      },
      true
    )
    return noStoreJson(await apiJson(response))
  } catch (error) {
    return routeError(error, "The price could not be saved")
  }
}
