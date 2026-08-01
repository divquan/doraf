import { NextRequest } from "next/server"
import {
  apiRequest,
  noStoreJson,
  requireSameOrigin,
  routeError,
} from "@/lib/internal-api"

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const body = (await request.json()) as { action?: "preview" | "commit" }
    if (body.action !== "preview" && body.action !== "commit") {
      throw new Error("A valid inventory action is required")
    }
    const response = await apiRequest(
      body.action === "preview"
        ? "/admin/inventory/imports/preview"
        : "/admin/inventory/imports",
      {
        method: "POST",
        body: JSON.stringify({ ...body, action: undefined }),
      },
      true
    )
    const responseBody: unknown = await response.json().catch(() => ({
      message: "The inventory request could not be completed",
    }))
    return noStoreJson(responseBody, { status: response.status })
  } catch (error) {
    return routeError(error, "The inventory request could not be completed")
  }
}
