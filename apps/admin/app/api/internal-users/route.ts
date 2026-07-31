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
        await apiRequest(
          "/admin/internal-users",
          { method: "POST", body: JSON.stringify(body) },
          true
        )
      )
    )
  } catch (error) {
    return noStoreJson(
      {
        message:
          error instanceof Error
            ? error.message
            : "Invitation could not be created",
      },
      { status: error instanceof ApiError ? error.status : 500 }
    )
  }
}
