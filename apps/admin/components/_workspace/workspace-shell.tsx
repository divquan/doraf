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
    <div className="flex min-h-svh bg-background">
      <WorkspaceSidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        role={role}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceTopbar
          displayName={displayName}
          onOpenMobile={() => setMobileOpen(true)}
          role={role}
        />

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
