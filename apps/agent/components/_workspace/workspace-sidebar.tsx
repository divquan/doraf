"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  DashboardSquare01Icon,
  ShoppingBag01Icon,
  Tag01Icon,
  Wallet02Icon,
  MoneySend01Icon,
  Settings02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { DorafMark } from "@/components/doraf-mark"

export interface NavItem {
  href: string
  label: string
  icon: typeof DashboardSquare01Icon
  badge?: string
}

export interface NavGroup {
  id: string
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    id: "overview",
    title: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: DashboardSquare01Icon,
      },
    ],
  },
  {
    id: "sales-catalog",
    title: "Sales & Catalog",
    items: [
      {
        href: "/sales",
        label: "Sales Channels",
        icon: ShoppingBag01Icon,
      },
      {
        href: "/pricing",
        label: "Pricing Setup",
        icon: Tag01Icon,
      },
    ],
  },
  {
    id: "finance",
    title: "Finance & Wallet",
    items: [
      {
        href: "/wallet",
        label: "Wallet Balance",
        icon: Wallet02Icon,
      },
      {
        href: "/withdrawals",
        label: "Withdrawals",
        icon: MoneySend01Icon,
      },
    ],
  },
  {
    id: "account",
    title: "Account",
    items: [
      {
        href: "/settings",
        label: "Settings",
        icon: Settings02Icon,
      },
    ],
  },
]

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard"
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

interface WorkspaceSidebarProps {
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function WorkspaceSidebar({
  mobileOpen,
  onCloseMobile,
}: WorkspaceSidebarProps) {
  const pathname = usePathname()

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-card text-card-foreground">
      {/* Header / Brand */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-border">
        <div className="flex items-center gap-3 overflow-hidden">
          <DorafMark />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
            Agent Portal
          </span>
        </div>
        {/* Mobile Close Trigger */}
        <Button
          aria-label="Close navigation"
          className="flex lg:hidden"
          onClick={onCloseMobile}
          size="sm"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon data-icon="inline-start" icon={Cancel01Icon} />
        </Button>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav aria-label="Main Navigation" className="flex flex-col gap-6">
          {navGroups.map((group) => (
            <div key={group.id} className="flex flex-col gap-1.5">
              {/* Group Title */}
              <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </div>

              {/* Group Items */}
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href)

                  return (
                    <li key={item.href}>
                      <Link
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          "hover:bg-accent hover:text-accent-foreground",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "bg-accent text-accent-foreground font-semibold shadow-sm"
                            : "text-muted-foreground"
                        )}
                        href={item.href}
                        onClick={onCloseMobile}
                      >
                        <HugeiconsIcon
                          className={cn(
                            "transition-colors",
                            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                          )}
                          icon={item.icon}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer info / Branding line */}
      <div className="p-4 border-t border-border flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">Doraf Agent Workspace</p>
        <p className="text-[10px] text-muted-foreground/70">v1.0 • Verified Security</p>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-border">
        <div className="sticky top-0 h-svh">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer (Slide-over overlay) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer content */}
          <aside className="relative z-10 w-72 max-w-[80vw] border-r border-border shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
