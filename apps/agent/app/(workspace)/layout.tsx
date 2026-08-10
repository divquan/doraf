import { redirect } from "next/navigation"
import { WorkspaceShell } from "@/components/_workspace/workspace-shell"
import { apiJson, apiRequest } from "@/lib/agent-api"
import type { OnboardingState } from "@/components/_workspace/onboarding-modal"

interface WorkspaceAgent {
  agent: {
    id: string
    tenantId: string
    name: string
    phoneMask: string
    status: "ACTIVE" | "SUSPENDED"
  }
}

interface OnboardingResponse {
  status: OnboardingState["status"]
  currentStep: number
  completedCount: number
  totalSteps: number
  startedAt: string | null
  completedAt: string | null
  lastDismissedAt: string | null
  steps: OnboardingState["steps"]
  prices: OnboardingState["prices"]
  storefront: OnboardingState["storefront"]
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
  const [sessionRes, onboardingRes] = await Promise.all([
    apiRequest("/agent-auth/session", {}, true),
    apiRequest("/agent-auth/onboarding", {}, true),
  ])

  if (sessionRes.status === 401) {
    redirect("/login")
  }

  const { agent } = (await apiJson(sessionRes)) as WorkspaceAgent
  const onboarding = onboardingRes.ok
    ? ((await apiJson(onboardingRes)) as OnboardingResponse)
    : null

  return (
    <WorkspaceShell
      name={agent.name}
      onboarding={
        onboarding
          ? {
              agentName: agent.name,
              initialState: onboarding,
              readOnly: agent.status === "SUSPENDED",
            }
          : null
      }
      phoneMask={agent.phoneMask}
      status={agent.status}
    >
      {children}
    </WorkspaceShell>
  )
}
