import {
  apiJson,
  apiRequest,
  noStoreJson,
  routeError,
} from "@/lib/internal-api"

export async function GET() {
  try {
    return noStoreJson(
      await apiJson(await apiRequest("/internal-auth/session", {}, true))
    )
  } catch (error) {
    return routeError(error, "Session could not be loaded")
  }
}
