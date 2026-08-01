import { NextRequest } from "next/server"
import { apiJson, apiRequest, noStoreJson, routeError } from "@/lib/agent-api"

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization")
    const result = await apiJson(
      await apiRequest("/buyer-recovery/vouchers", {
        headers: authorization ? { authorization } : undefined,
      })
    )
    return noStoreJson(result)
  } catch (error) {
    return routeError(error, "The vouchers could not be recovered")
  }
}
