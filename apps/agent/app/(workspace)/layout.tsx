import { redirect } from "next/navigation"
import { WorkspaceShell } from "@/components/_workspace/workspace-shell"
import { apiJson, apiRequest } from "@/lib/agent-api"

interface WorkspaceAgent {
  agent: {
    id: string
    tenantId: string
    name: string
    phoneMask: string
    status: "ACTIVE" | "SUSPENDED"
  }
}

/**
 * Shared authenticated agent workspace layout. Renders the unified workspace
 * shell featuring a left collapsible sidebar and a single top bar.
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sessionRes = await apiRequest("/agent-auth/session", {}, true)

  if (sessionRes.status === 401) {
    redirect("/login")
  }

  const { agent } = (await apiJson(sessionRes)) as WorkspaceAgent

  return (
    <WorkspaceShell
      name={agent.name}
      phoneMask={agent.phoneMask}
      status={agent.status}
    >
      {children}
    </WorkspaceShell>
  )
}

