import { NextRequest } from "next/server"
import {
  apiJson,
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
} from "@/lib/agent-api"

export async function GET() {
  try {
    return noStoreJson(
      await apiJson(
        await apiRequest("/agent-wallet/payout-destination", {}, true)
      )
    )
  } catch (error) {
    return routeError(error, "Failed to load payout destination")
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    return noStoreJson(
      await apiJson(
        await apiRequest(
          "/agent-wallet/payout-destination",
          { method: "POST", body: JSON.stringify(await request.json()) },
          true
        )
      )
    )
  } catch (error) {
    return routeError(error, "Failed to save payout destination")
  }
}
