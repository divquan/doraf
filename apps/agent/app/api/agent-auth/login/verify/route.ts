import { NextRequest } from "next/server"
import {
  apiJson,
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
  setAgentSession,
} from "@/lib/agent-api"

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const result = (await apiJson(
      await apiRequest("/agent-auth/login/verify", {
        method: "POST",
        body: JSON.stringify(await request.json()),
      })
    )) as { token: string; expiresAt: string; agent: unknown }
    const response = noStoreJson({ agent: result.agent })
    setAgentSession(response, result.token, result.expiresAt)
    return response
  } catch (error) {
    return routeError(error, "Sign in could not be completed")
  }
}
