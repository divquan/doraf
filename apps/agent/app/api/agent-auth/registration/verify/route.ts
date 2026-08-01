import { NextRequest } from "next/server"
import {
  apiJson,
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
  setRegistrationSession,
} from "@/lib/agent-api"

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const result = (await apiJson(
      await apiRequest("/agent-auth/registration/verify", {
        method: "POST",
        body: JSON.stringify(await request.json()),
      })
    )) as { registrationToken: string; expiresAt: string }
    const response = noStoreJson({ expiresAt: result.expiresAt })
    setRegistrationSession(response, result.registrationToken, result.expiresAt)
    return response
  } catch (error) {
    return routeError(error, "The verification code could not be confirmed")
  }
}
