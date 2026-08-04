import { NextRequest } from "next/server"
import {
  apiJson,
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
} from "@/lib/agent-api"

export async function PATCH(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const body: unknown = await request.json()
    const response = await apiRequest(
      "/agent/storefront",
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
      true
    )
    const data: unknown = await apiJson(response)
    return noStoreJson(data, { status: response.status })
  } catch (error) {
    return routeError(error, "The storefront settings could not be updated")
  }
}
