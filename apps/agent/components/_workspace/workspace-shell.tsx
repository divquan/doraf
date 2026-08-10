"use client"

import { useState } from "react"
import { WorkspaceSidebar } from "@/components/_workspace/workspace-sidebar"
import { WorkspaceTopbar } from "@/components/_workspace/workspace-topbar"
import {
  OnboardingModal,
  type OnboardingState,
} from "@/components/_workspace/onboarding-modal"

interface WorkspaceOnboarding {
  agentName: string
  initialState: OnboardingState
  readOnly: boolean
}

interface WorkspaceShellProps {
  name: string
  phoneMask: string
  status: "ACTIVE" | "SUSPENDED"
  onboarding?: WorkspaceOnboarding | null
  children: React.ReactNode
}

export function WorkspaceShell({
  name,
  phoneMask,
  status,
  onboarding,
  children,
}: WorkspaceShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(() =>
    Boolean(
      onboarding &&
      !onboarding.readOnly &&
      onboarding.initialState.status !== "COMPLETED"
    )
  )
  const [onboardingAvailable, setOnboardingAvailable] = useState(() =>
    Boolean(
      onboarding &&
      !onboarding.readOnly &&
      onboarding.initialState.status !== "COMPLETED"
    )
  )

  return (
    <div className="flex min-h-svh bg-muted/20">
      {/* Fixed Left Sidebar Navigation */}
      <WorkspaceSidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Workspace Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Single Unified Top Bar */}
        <WorkspaceTopbar
          name={name}
          onOpenMobile={() => setMobileOpen(true)}
          onContinueSetup={
            onboardingAvailable && !onboardingOpen
              ? () => setOnboardingOpen(true)
              : undefined
          }
          phoneMask={phoneMask}
          status={status}
        />

        {/* Workspace Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>

        {onboarding ? (
          <OnboardingModal
            agentName={onboarding.agentName}
            initialState={onboarding.initialState}
            onCompleted={() => setOnboardingAvailable(false)}
            onOpenChange={setOnboardingOpen}
            open={onboardingOpen}
            readOnly={onboarding.readOnly}
          />
        ) : null}
      </div>
    </div>
  )
}
