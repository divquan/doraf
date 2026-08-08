import { AgentAuthFlow } from "@/components/agent-auth-flow"
import { AuthPageShell } from "@/components/auth-page-shell"
import { apiRequest } from "@/lib/agent-api"
import { redirect } from "next/navigation"

export default async function LoginPage() {
  let hasValidSession = false
  try {
    hasValidSession = (await apiRequest("/agent-auth/session", {}, true)).ok
  } catch {
    // Render the login form so a temporary API outage does not create a
    // redirect loop or prevent the user from retrying.
  }
  if (hasValidSession) redirect("/dashboard")

  return (
    <AuthPageShell>
      <AgentAuthFlow mode="login" />
    </AuthPageShell>
  )
}
