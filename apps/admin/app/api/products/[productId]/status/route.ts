import { NextRequest } from "next/server"
import {
  apiJson,
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
} from "@/lib/internal-api"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    requireSameOrigin(request)
    const { productId } = await params
    const body = (await request.json()) as {
      status?: "ACTIVE" | "UNAVAILABLE"
      reason?: string
    }
    if (body.status !== "ACTIVE" && body.status !== "UNAVAILABLE") {
      throw new Error("A valid product status is required")
    }
    const response = await apiRequest(
      `/admin/products/${encodeURIComponent(productId)}/status`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      true
    )
    return noStoreJson(await apiJson(response))
  } catch (error) {
    return routeError(error, "The product status could not be changed")
  }
}
