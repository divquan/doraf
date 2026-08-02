import { randomUUID } from "node:crypto"
import { NextRequest } from "next/server"
import {
  apiJson,
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
} from "@/lib/internal-api"

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const response = await apiRequest(
      "/admin/reporting/requeue-outbox",
      {
        method: "POST",
        headers: { "x-request-id": randomUUID() },
      },
      true
    )
    return noStoreJson(await apiJson(response))
  } catch (error) {
    return routeError(error, "Stuck outbox events could not be requeued")
  }
}
