"use client"

import { Menu01Icon, User02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { LogoutButton } from "@/components/logout-button"

interface WorkspaceTopbarProps {
  name: string
  phoneMask: string
  status: "ACTIVE" | "SUSPENDED"
  onOpenMobile: () => void
}

export function WorkspaceTopbar({
  name,
  phoneMask,
  status,
  onOpenMobile,
}: WorkspaceTopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      {/* Left: Mobile Navigation Trigger */}
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
      </div>

      {/* Right: Identity Badge, Status & Logout */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Status Badge */}
        <Badge
          className="hidden sm:inline-flex text-xs px-2 py-0.5"
          variant={status === "ACTIVE" ? "secondary" : "destructive"}
        >
          {status}
        </Badge>

        {/* Agent Profile Pill */}
        <div className="flex items-center gap-2.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-sm">
          <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HugeiconsIcon className="size-4" icon={User02Icon} />
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-xs font-semibold leading-tight text-foreground">{name}</p>
            <p className="text-[10px] leading-tight text-muted-foreground">{phoneMask}</p>
          </div>
        </div>

        {/* Sign Out Action */}
        <LogoutButton />
      </div>
    </header>
  )
}
