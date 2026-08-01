import { cookies } from "next/headers"
import { NextRequest } from "next/server"
import {
  apiJson,
  apiRequest,
  clearCookie,
  noStoreJson,
  registrationCookie,
  requireSameOrigin,
  routeError,
  setAgentSession,
} from "@/lib/agent-api"

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const registrationToken = (await cookies()).get(registrationCookie)?.value
    if (!registrationToken) {
      return noStoreJson(
        { message: "Your registration session has expired" },
        { status: 401 }
      )
    }
    const body = (await request.json()) as { name?: unknown }
    const result = (await apiJson(
      await apiRequest("/agent-auth/registration/complete", {
        method: "POST",
        body: JSON.stringify({
          name: body.name,
          registrationToken,
        }),
      })
    )) as {
      token: string
      expiresAt: string
      agent: unknown
    }
    const response = noStoreJson({ agent: result.agent })
    setAgentSession(response, result.token, result.expiresAt)
    clearCookie(response, registrationCookie)
    return response
  } catch (error) {
    return routeError(error, "Registration could not be completed")
  }
}
