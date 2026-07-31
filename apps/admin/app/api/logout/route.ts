import { NextRequest } from "next/server"

import {
  apiRequest,
  clearSession,
  noStoreJson,
  requireSameOrigin,
} from "@/lib/internal-api"

export async function POST(request: NextRequest) {
  requireSameOrigin(request)

  try {
    await apiRequest("/internal-auth/logout", { method: "POST" }, true)
  } catch {
    // Session expiry or an unavailable API must not prevent local sign-out.
  }

  const response = noStoreJson({ loggedOut: true })
  clearSession(response)
  return response
}
