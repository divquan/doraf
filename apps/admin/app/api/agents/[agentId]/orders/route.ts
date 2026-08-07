import { randomUUID } from "node:crypto"
import { NextRequest } from "next/server"
import {
  apiJson,
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
} from "@/lib/internal-api"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    requireSameOrigin(request)
    const { agentId } = await params
    const search = request.nextUrl.searchParams
    const query = new URLSearchParams()
    const page = search.get("page")
    const limit = search.get("limit")
    if (page) query.set("page", page)
    if (limit) query.set("limit", limit)
    const suffix = query.size > 0 ? `?${query.toString()}` : ""
    const response = await apiRequest(
      `/admin/agents/${encodeURIComponent(agentId)}/orders${suffix}`,
      { headers: { "x-request-id": randomUUID() } },
      true
    )
    return noStoreJson(await apiJson(response))
  } catch (error) {
    return routeError(error, "The agent's orders could not be loaded")
  }
}
