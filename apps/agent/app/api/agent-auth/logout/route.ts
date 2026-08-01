import { NextRequest } from "next/server"
import {
  agentSessionCookie,
  apiRequest,
  clearCookie,
  noStoreJson,
  requireSameOrigin,
  routeError,
} from "@/lib/agent-api"

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    await apiRequest("/agent-auth/logout", { method: "POST" }, true)
    const response = noStoreJson({ ok: true })
    clearCookie(response, agentSessionCookie)
    return response
  } catch (error) {
    return routeError(error, "Sign out could not be completed")
  }
}
