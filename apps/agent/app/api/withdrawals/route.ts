import { NextRequest } from "next/server"
import {
  apiJson,
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
} from "@/lib/agent-api"

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    return noStoreJson(
      await apiJson(
        await apiRequest(
          "/agent-wallet/withdrawals",
          { method: "POST", body: JSON.stringify(await request.json()) },
          true
        )
      )
    )
  } catch (error) {
    return routeError(error, "The withdrawal request could not be created")
  }
}
