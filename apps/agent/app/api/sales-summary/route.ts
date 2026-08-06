import {
  apiJson,
  apiRequest,
  noStoreJson,
  routeError,
} from "@/lib/agent-api"

export async function GET() {
  try {
    return noStoreJson(
      await apiJson(
        await apiRequest("/agent-auth/sales-summary", {}, true)
      )
    )
  } catch (error) {
    return routeError(error, "Failed to load sales summary")
  }
}
