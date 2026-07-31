import { NextRequest } from "next/server"

import {
  apiJson,
  apiRequest,
  ApiError,
  noStoreJson,
  requireSameOrigin,
  setSession,
} from "@/lib/internal-api"

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const body = await request.json()
    const result = (await apiJson(
      await apiRequest("/internal-auth/passkeys/authentication/verify", {
        method: "POST",
        body: JSON.stringify(body),
      })
    )) as {
      token: string
      expiresAt: string
      user: { displayName: string; role: string }
    }
    const response = noStoreJson({ user: result.user })
    setSession(response, result.token, result.expiresAt)
    return response
  } catch (error) {
    return noStoreJson(
      {
        message:
          error instanceof Error ? error.message : "Authentication failed",
      },
      { status: error instanceof ApiError ? error.status : 500 }
    )
  }
}
