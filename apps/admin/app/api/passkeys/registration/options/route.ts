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
    const body = await request.json()
    return noStoreJson(
      await apiJson(
        await apiRequest("/internal-auth/passkeys/registration/options", {
          method: "POST",
          body: JSON.stringify(body),
        })
      )
    )
  } catch (error) {
    return noStoreJson(
      {
        message:
          error instanceof Error
            ? error.message
            : "Enrollment could not be started",
      },
      { status: error instanceof ApiError ? error.status : 500 }
    )
  }
}
