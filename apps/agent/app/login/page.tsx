import { AgentAuthFlow } from "@/components/agent-auth-flow"
import { AuthPageShell } from "@/components/auth-page-shell"

export default function LoginPage() {
  return (
    <AuthPageShell>
      <AgentAuthFlow mode="login" />
    </AuthPageShell>
  )
}
