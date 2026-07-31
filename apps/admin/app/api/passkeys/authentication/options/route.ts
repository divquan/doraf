import { NextRequest } from "next/server"

import {
  apiJson,
  apiRequest,
  ApiError,
  noStoreJson,
  requireSameOrigin,
} from "@/lib/internal-api"

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    return noStoreJson(
      await apiJson(
        await apiRequest("/internal-auth/passkeys/authentication/options", {
          method: "POST",
        })
      )
    )
  } catch (error) {
    return noStoreJson(
      {
        message:
          error instanceof Error
            ? error.message
            : "Authentication could not be started",
      },
      { status: error instanceof ApiError ? error.status : 500 }
    )
  }
}
