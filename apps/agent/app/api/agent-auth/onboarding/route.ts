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
      await apiJson(await apiRequest("/agent-auth/onboarding", {}, true))
    )
  } catch (error) {
    return routeError(error, "Onboarding could not be loaded")
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const body: unknown = await request.json()
    return noStoreJson(
      await apiJson(
        await apiRequest(
          "/agent-auth/onboarding",
          { method: "POST", body: JSON.stringify(body) },
          true
        )
      )
    )
  } catch (error) {
    return routeError(error, "Onboarding could not be updated")
  }
}
