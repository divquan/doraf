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
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    requireSameOrigin(request)
    const { agentId } = await params
    const body = (await request.json()) as {
      status?: "ACTIVE" | "SUSPENDED"
      reason?: string
    }
    if (body.status !== "ACTIVE" && body.status !== "SUSPENDED") {
      throw new Error("A valid agent status is required")
    }
    const action = body.status === "SUSPENDED" ? "suspend" : "restore"
    const response = await apiRequest(
      `/admin/agents/${encodeURIComponent(agentId)}/${action}`,
      {
        method: "POST",
        body: JSON.stringify({ reason: body.reason }),
      },
      true
    )
    return noStoreJson(await apiJson(response))
  } catch (error) {
    return routeError(error, "The agent status could not be changed")
  }
}
