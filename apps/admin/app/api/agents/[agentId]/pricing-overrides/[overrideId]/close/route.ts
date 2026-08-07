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
  { params }: { params: Promise<{ agentId: string; overrideId: string }> }
) {
  try {
    requireSameOrigin(request)
    const { agentId, overrideId } = await params
    const body = (await request.json()) as { reason?: string }
    const reason = String(body.reason ?? "").trim()
    if (reason.length < 5) {
      throw new Error("A reason of at least 5 characters is required")
    }
    const response = await apiRequest(
      `/admin/agents/${encodeURIComponent(agentId)}/pricing-overrides/${encodeURIComponent(overrideId)}/close`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      },
      true
    )
    return noStoreJson(await apiJson(response))
  } catch (error) {
    return routeError(error, "The pricing override could not be removed")
  }
}
