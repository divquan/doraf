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
  InformationCircleIcon,
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

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: DashboardSquare01Icon,
  },
  {
    href: "/my-store",
    label: "My Store",
    icon: ShoppingBag01Icon,
  },
  {
    href: "/pricing",
    label: "Pricing Setup",
    icon: Tag01Icon,
  },
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
  {
    href: "/settings",
    label: "Settings",
    icon: Settings02Icon,
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

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav aria-label="Main Navigation">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
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
        </nav>
      </div>

      {/* Support & Help Link */}
      <div className="p-4 border-t border-border bg-muted/5">
        <a
          href="mailto:support@doraf.com?subject=Doraf%20Agent%20Support"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200"
        >
          <HugeiconsIcon icon={InformationCircleIcon} className="size-4 text-muted-foreground" />
          <span>Help & Support</span>
        </a>
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
