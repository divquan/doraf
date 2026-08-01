import { randomUUID } from "node:crypto"
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
  context: RouteContext<"/api/withdrawals/[withdrawalId]">
) {
  try {
    requireSameOrigin(request)
    const { withdrawalId } = await context.params
    const body = (await request.json()) as {
      action?: "approve" | "reject" | "verify" | "finalize"
      reason?: string
      otp?: string
    }
    const action = body.action
    if (!action) throw new Error("Withdrawal action is required")
    const suffix =
      action === "verify"
        ? "verify-transfer"
        : action === "finalize"
          ? "finalize-transfer"
          : action
    const payload =
      action === "approve" || action === "reject"
        ? { reason: body.reason }
        : action === "finalize"
          ? { otp: body.otp }
          : undefined
    const response = await apiRequest(
      `/admin/withdrawals/${encodeURIComponent(withdrawalId)}/${suffix}`,
      {
        method: "POST",
        headers: { "x-request-id": randomUUID() },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      },
      true
    )
    return noStoreJson(await apiJson(response))
  } catch (error) {
    return routeError(error, "The withdrawal could not be updated")
  }
}
