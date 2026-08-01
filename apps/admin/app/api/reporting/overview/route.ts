import { randomUUID } from "node:crypto"
import { NextRequest } from "next/server"
import {
  apiJson,
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
} from "@/lib/internal-api"

export async function GET(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const response = await apiRequest(
      "/admin/reporting/overview",
      {
        headers: { "x-request-id": randomUUID() },
      },
      true
    )
    return noStoreJson(await apiJson(response))
  } catch (error) {
    return routeError(error, "Reporting metrics could not be loaded")
  }
}
