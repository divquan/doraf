import { redirect } from "next/navigation"
import { apiRequest } from "@/lib/agent-api"

export default async function Page() {
  let destination = "/login"
  try {
    destination = (await apiRequest("/agent-auth/session", {}, true)).ok
      ? "/dashboard"
      : "/login"
  } catch {
    // Keep the login page usable if the API is temporarily unavailable.
  }
  redirect(destination)
}
