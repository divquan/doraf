import { redirect } from "next/navigation"
import { WorkspaceShell } from "@/components/_workspace/workspace-shell"
import type { AdminRole } from "@/components/_workspace/workspace-sidebar"
import { apiJson, apiRequest } from "@/lib/internal-api"

interface WorkspaceSession {
  operator: {
    id: string
    displayName: string
    role: AdminRole
  }
}

/**
 * Shared authenticated admin workspace layout. Renders the unified workspace
 * shell featuring a left collapsible sidebar and a single top bar.
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sessionRes = await apiRequest("/internal-auth/session", {}, true)

  if (sessionRes.status === 401) {
    redirect("/login")
  }

  const { operator } = (await apiJson(sessionRes)) as WorkspaceSession

  return (
    <WorkspaceShell displayName={operator.displayName} role={operator.role}>
      {children}
    </WorkspaceShell>
  )
}
