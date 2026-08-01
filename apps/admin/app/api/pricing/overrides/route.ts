import { randomUUID } from "node:crypto"
import { NextRequest } from "next/server"
import {
  apiJson,
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
} from "@/lib/internal-api"

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const body = (await request.json()) as {
      productId?: string
      agentId?: string
    }
    if (!body.productId || !body.agentId)
      throw new Error("Product and agent are required")
    const response = await apiRequest(
      `/admin/products/${encodeURIComponent(body.productId)}/agent-overrides/${encodeURIComponent(body.agentId)}`,
      {
        method: "POST",
        headers: { "idempotency-key": randomUUID() },
        body: JSON.stringify({
          ...body,
          productId: undefined,
          agentId: undefined,
        }),
      },
      true
    )
    return noStoreJson(await apiJson(response))
  } catch (error) {
    return routeError(error, "Pricing override could not be created")
  }
}
