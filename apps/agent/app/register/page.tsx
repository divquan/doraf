import { AgentAuthFlow } from "@/components/agent-auth-flow"
import { AuthPageShell } from "@/components/auth-page-shell"

export default function RegisterPage() {
  return (
    <AuthPageShell>
      <AgentAuthFlow mode="register" />
    </AuthPageShell>
  )
}
