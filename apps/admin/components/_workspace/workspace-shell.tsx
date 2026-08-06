"use client"

import { useState } from "react"
import { WorkspaceSidebar } from "@/components/_workspace/workspace-sidebar"
import { WorkspaceTopbar } from "@/components/_workspace/workspace-topbar"
import type { AdminRole } from "@/components/_workspace/workspace-sidebar"

interface WorkspaceShellProps {
  displayName: string
  role: AdminRole
  children: React.ReactNode
}

export function WorkspaceShell({
  displayName,
  role,
  children,
}: WorkspaceShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-svh bg-muted/20">
      {/* Fixed Left Sidebar Navigation */}
      <WorkspaceSidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        role={role}
      />

      {/* Main Workspace Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Single Unified Top Bar */}
        <WorkspaceTopbar
          displayName={displayName}
          onOpenMobile={() => setMobileOpen(true)}
          role={role}
        />

        {/* Workspace Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
