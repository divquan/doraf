"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Menu01Icon, User02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { LogoutButton } from "@/components/logout-button"
import { ThemeSelector } from "@/components/_workspace/theme-selector"

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
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Breadcrumb mapping
  const routeMap: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/my-store": "My Store",
    "/sales": "My Store",
    "/pricing": "Pricing Setup",
    "/earnings": "Earnings Balance",
    "/settings": "Settings",
  }

  const segments = pathname.split("/").filter(Boolean)
  const lastSegment = segments[segments.length - 1]
  const fallbackTitle = lastSegment
    ? lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1).replace(/-/g, " ")
    : "Workspace"
  const pageTitle = routeMap[pathname] || fallbackTitle

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Toggle theme on pressing 'D' when not typing
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return
      }

      if (event.key.toLowerCase() === "d") {
        event.preventDefault()
        const resolvedTheme =
          theme === "system"
            ? window.matchMedia("(prefers-color-scheme: dark)").matches
              ? "dark"
              : "light"
            : theme
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [theme, setTheme])

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      {/* Left: Mobile Navigation Trigger & Breadcrumbs */}
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

        {/* Desktop Breadcrumbs */}
        <div className="hidden lg:flex items-center gap-2 text-sm font-medium">
          <span className="text-muted-foreground select-none">Workspace</span>
          <span className="text-muted-foreground/30 select-none">/</span>
          <span className="text-foreground">{pageTitle}</span>
        </div>
      </div>

      {/* Right: Unified Profile Button & Popover */}
      <div className="relative" ref={containerRef}>
        {/* Trigger Button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2.5 rounded-full border border-border bg-muted/30 hover:bg-muted/60 pl-2 pr-3 py-1.5 text-sm transition-all duration-200 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          <div className="relative flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
            <HugeiconsIcon className="size-3.5" icon={User02Icon} />
          </div>
          <div className="hidden text-left sm:block min-w-0 max-w-[120px]">
            <p className="text-xs font-semibold leading-tight text-foreground truncate">
              {name}
            </p>
            <p className="text-[9px] leading-tight text-muted-foreground truncate">
              {phoneMask}
            </p>
          </div>
        </button>

        {/* Popover Card */}
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-popover text-popover-foreground shadow-lg focus:outline-none z-50 p-4 space-y-4 animate-in fade-in-50 slide-in-from-top-1 duration-100">
            {/* User Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Account
                </span>
                <Badge
                  variant={status === "ACTIVE" ? "secondary" : "destructive"}
                  className="text-[9px] px-1.5 py-0 h-4 leading-none"
                >
                  {status}
                </Badge>
              </div>
              <div className="rounded-lg bg-muted/20 p-2.5 border">
                <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                <p className="text-xs text-muted-foreground truncate">{phoneMask}</p>
              </div>
            </div>

            {/* Appearance settings */}
            <div className="space-y-2.5 border-t border-border pt-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Preferences
              </span>
              <div className="space-y-2">
                <ThemeSelector />
                <div className="text-[10px] text-muted-foreground/80 leading-normal bg-muted/10 p-2 rounded-lg border border-dashed">
                 Press <kbd className="px-1.5 py-0.5 border rounded bg-background text-[9px] font-mono select-none font-semibold">D</kbd> on your keyboard to toggle theme.
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-border pt-3">
              <LogoutButton
                variant="destructive"
                size="sm"
                showText={true}
                className="w-full justify-center text-xs"
              />
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
