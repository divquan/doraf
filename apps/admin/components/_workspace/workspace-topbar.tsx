"use client"

import { usePathname } from "next/navigation"
import { Menu01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { LogoutButton } from "@/components/logout-button"
import type { AdminRole } from "@/components/_workspace/workspace-sidebar"

const routeMap: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/inventory": "Inventory",
  "/withdrawals": "Withdrawals",
  "/agents": "Agents",
  "/operators": "Operators",
  "/settings": "Settings",
}

interface WorkspaceTopbarProps {
  displayName: string
  role: AdminRole
  onOpenMobile: () => void
}

export function WorkspaceTopbar({
  displayName,
  role,
  onOpenMobile,
}: WorkspaceTopbarProps) {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)
  const lastSegment = segments[segments.length - 1]
  const fallbackTitle = lastSegment
    ? lastSegment.charAt(0).toUpperCase() +
      lastSegment.slice(1).replace(/-/g, " ")
    : "Workspace"
  const pageTitle = routeMap[pathname] ?? fallbackTitle

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      <div className="flex items-center gap-3">
        <Button
          aria-label="Open navigation menu"
          className="flex lg:hidden"
          onClick={onOpenMobile}
          size="sm"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon data-icon="inline-start" icon={Menu01Icon} />
        </Button>

        <div className="hidden items-center gap-2 text-sm font-medium lg:flex">
          <span className="text-muted-foreground select-none">Workspace</span>
          <span className="text-muted-foreground/30 select-none">/</span>
          <span className="text-foreground">{pageTitle}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2.5 sm:flex">
          <span className="max-w-[160px] truncate text-sm font-semibold">
            {displayName}
          </span>
          <Badge variant={role === "ADMINISTRATOR" ? "default" : "secondary"}>
            {role === "ADMINISTRATOR" ? "Administrator" : "Support"}
          </Badge>
        </div>
        <LogoutButton />
      </div>
    </header>
  )
}
