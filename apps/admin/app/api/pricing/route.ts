import { randomUUID } from "node:crypto"
import { NextRequest } from "next/server"
import {
  apiJson,
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
} from "@/lib/internal-api"

export async function GET() {
  try {
    return noStoreJson(
      await apiJson(await apiRequest("/admin/products/pricing", {}, true))
    )
  } catch (error) {
    return routeError(error, "Pricing could not be loaded")
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const body = (await request.json()) as { productId?: string }
    if (!body.productId) throw new Error("Product is required")
    const response = await apiRequest(
      `/admin/products/${encodeURIComponent(body.productId)}/pricing-policies`,
      {
        method: "POST",
        headers: { "idempotency-key": randomUUID() },
        body: JSON.stringify({ ...body, productId: undefined }),
      },
      true
    )
    return noStoreJson(await apiJson(response))
  } catch (error) {
    return routeError(error, "Pricing policy could not be created")
  }
}
