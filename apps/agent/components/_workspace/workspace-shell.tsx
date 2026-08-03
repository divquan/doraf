"use client"

import { useState } from "react"
import { WorkspaceSidebar } from "@/components/_workspace/workspace-sidebar"
import { WorkspaceTopbar } from "@/components/_workspace/workspace-topbar"

interface WorkspaceShellProps {
  name: string
  phoneMask: string
  status: "ACTIVE" | "SUSPENDED"
  children: React.ReactNode
}

export function WorkspaceShell({
  name,
  phoneMask,
  status,
  children,
}: WorkspaceShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-svh bg-muted/20">
      {/* Fixed Left Sidebar Navigation */}
      <WorkspaceSidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Workspace Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Single Unified Top Bar */}
        <WorkspaceTopbar
          name={name}
          onOpenMobile={() => setMobileOpen(true)}
          phoneMask={phoneMask}
          status={status}
        />

        {/* Workspace Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
