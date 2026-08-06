import { NextRequest } from "next/server"
import {
  apiJson,
  apiRequest,
  noStoreJson,
  routeError,
} from "@/lib/agent-api"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const query = searchParams.toString()
    const endpoint = query ? `/agent-auth/orders?${query}` : "/agent-auth/orders"
    return noStoreJson(
      await apiJson(
        await apiRequest(endpoint, {}, true)
      )
    )
  } catch (error) {
    return routeError(error, "Failed to load recent orders")
  }
}
