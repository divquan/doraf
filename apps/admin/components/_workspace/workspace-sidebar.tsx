"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BoxIcon,
  Cancel01Icon,
  DashboardSquare01Icon,
  MoneyReceiveCircleIcon,
  ShoppingBag01Icon,
  Settings02Icon,
  UserAdd02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

export type AdminRole = "ADMINISTRATOR" | "SUPPORT"

export interface NavItem {
  href: string
  label: string
  icon: typeof DashboardSquare01Icon
  roles: AdminRole[]
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: DashboardSquare01Icon,
    roles: ["ADMINISTRATOR", "SUPPORT"],
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: BoxIcon,
    roles: ["ADMINISTRATOR", "SUPPORT"],
  },
  {
    href: "/orders",
    label: "Orders",
    icon: ShoppingBag01Icon,
    roles: ["ADMINISTRATOR", "SUPPORT"],
  },
  {
    href: "/withdrawals",
    label: "Withdrawals",
    icon: MoneyReceiveCircleIcon,
    roles: ["ADMINISTRATOR"],
  },
  {
    href: "/agents",
    label: "Agents",
    icon: UserGroupIcon,
    roles: ["ADMINISTRATOR"],
  },
  {
    href: "/operators",
    label: "Operators",
    icon: UserAdd02Icon,
    roles: ["ADMINISTRATOR"],
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings02Icon,
    roles: ["ADMINISTRATOR", "SUPPORT"],
  },
]

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard"
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

interface WorkspaceSidebarProps {
  role: AdminRole
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function WorkspaceSidebar({
  role,
  mobileOpen,
  onCloseMobile,
}: WorkspaceSidebarProps) {
  const pathname = usePathname()
  const visible = navItems.filter((item) => item.roles.includes(role))

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-card text-card-foreground">
      <div className="flex h-16 items-center justify-between border-b border-border px-5">
        <div className="flex items-center gap-2 select-none">
          <img
            src="/logo-mark.svg"
            alt="Dashchecker Logo"
            className="block h-7 w-auto object-contain dark:hidden"
          />
          <img
            src="/logo-mark-dark.svg"
            alt="Dashchecker Logo"
            className="hidden h-7 w-auto object-contain dark:block"
          />
          <span className="font-heading text-lg font-semibold">
            Dashchecker
          </span>
          <span className="rounded border border-border/50 bg-muted/60 px-1.5 py-0.5 text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground uppercase">
            Administration
          </span>
        </div>
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

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav aria-label="Main Navigation">
          <ul className="flex flex-col gap-1">
            {visible.map((item) => {
              const active = isActive(pathname, item.href)

              return (
                <li key={item.href}>
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      active
                        ? "bg-accent font-semibold text-accent-foreground shadow-sm"
                        : "text-muted-foreground"
                    )}
                    href={item.href}
                    onClick={onCloseMobile}
                  >
                    <HugeiconsIcon
                      className={cn(
                        "transition-colors",
                        active
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
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
    </div>
  )

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-border lg:block">
        <div className="sticky top-0 h-svh">{sidebarContent}</div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 w-72 max-w-[80vw] border-r border-border shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      ) : null}
    </>
  )
}
