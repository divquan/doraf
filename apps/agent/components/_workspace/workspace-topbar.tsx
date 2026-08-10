"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import {
  ArrowRight01Icon,
  Menu01Icon,
  User02Icon,
} from "@hugeicons/core-free-icons"
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
  onContinueSetup?: () => void
}

export function WorkspaceTopbar({
  name,
  phoneMask,
  status,
  onOpenMobile,
  onContinueSetup,
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
    ? lastSegment.charAt(0).toUpperCase() +
      lastSegment.slice(1).replace(/-/g, " ")
    : "Workspace"
  const pageTitle = routeMap[pathname] || fallbackTitle

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
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
        <Link
          aria-label="Open Dashchecker dashboard"
          className="group flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:hidden"
          href="/dashboard"
        >
          <span className="relative size-7">
            <Image
              alt=""
              className="absolute inset-0 size-7 object-contain opacity-100 drop-shadow-sm transition-opacity duration-200 dark:opacity-0"
              height={368}
              src="/logo-mark.svg"
              width={368}
            />
            <Image
              alt=""
              className="absolute inset-0 size-7 object-contain opacity-0 drop-shadow-sm transition-opacity duration-200 dark:opacity-100"
              height={368}
              src="/logo-mark-dark.svg"
              width={368}
            />
          </span>
        </Link>

        {/* Desktop Breadcrumbs */}
        <div className="hidden items-center gap-2 text-sm font-medium lg:flex">
          <span className="text-muted-foreground select-none">Workspace</span>
          <span className="text-muted-foreground/30 select-none">/</span>
          <span className="text-foreground">{pageTitle}</span>
        </div>
      </div>

      {/* Right: Setup action, profile button & popover */}
      <div className="flex items-center gap-2">
        {onContinueSetup ? (
          <Button
            aria-label="Continue setup"
            onClick={onContinueSetup}
            size="sm"
            type="button"
            variant="outline"
          >
            <span className="hidden sm:inline">Continue setup</span>
            <HugeiconsIcon data-icon="inline-end" icon={ArrowRight01Icon} />
          </Button>
        ) : null}

        <div className="relative" ref={containerRef}>
          {/* Trigger Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex size-10 items-center justify-center rounded-full border border-border bg-muted/30 p-0 text-sm transition-colors duration-200 outline-none select-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:h-auto sm:w-auto sm:justify-start sm:gap-2.5 sm:py-1.5 sm:pr-3 sm:pl-2"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <div className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <HugeiconsIcon className="size-3.5" icon={User02Icon} />
            </div>
            <div className="hidden max-w-[120px] min-w-0 text-left sm:block">
              <p className="truncate text-xs leading-tight font-semibold text-foreground">
                {name}
              </p>
              <p className="truncate text-[9px] leading-tight text-muted-foreground">
                {phoneMask}
              </p>
            </div>
          </button>

          {/* Popover Card */}
          {menuOpen && (
            <div className="absolute right-0 z-50 mt-2 w-64 animate-in space-y-4 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg duration-100 fade-in-50 slide-in-from-top-1 focus:outline-none">
              {/* User Details */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    Account
                  </span>
                  <Badge
                    variant={status === "ACTIVE" ? "secondary" : "destructive"}
                    className="h-4 px-1.5 py-0 text-[9px] leading-none"
                  >
                    {status}
                  </Badge>
                </div>
                <div className="rounded-lg border bg-muted/20 p-2.5">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {phoneMask}
                  </p>
                </div>
              </div>

              {/* Appearance settings */}
              <div className="space-y-2.5 border-t border-border pt-3">
                <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Preferences
                </span>
                <div className="space-y-2">
                  <ThemeSelector />
                  <div className="rounded-lg border border-dashed bg-muted/10 p-2 text-[10px] leading-normal text-muted-foreground/80">
                    Press{" "}
                    <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[9px] font-semibold select-none">
                      D
                    </kbd>{" "}
                    on your keyboard to toggle theme.
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
      </div>
    </header>
  )
}
