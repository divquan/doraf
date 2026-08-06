import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { PageHeader } from "@/components/_workspace/page-header"
import {
  AdminReportingOverviewData,
  OperationsDashboard,
} from "@/components/operations-dashboard"
import { apiJson, apiRequest } from "@/lib/internal-api"
import type { AdminRole } from "@/components/_workspace/workspace-sidebar"

interface DashboardSession {
  operator: {
    id: string
    displayName: string
    role: AdminRole
  }
}

const quickLinks: Array<{
  href: string
  label: string
  description: string
  roles: AdminRole[]
}> = [
  {
    href: "/inventory",
    label: "Inventory",
    description: "Stock counts and batch history",
    roles: ["ADMINISTRATOR", "SUPPORT"],
  },
  {
    href: "/pricing",
    label: "Pricing",
    description: "Product ranges and agent exceptions",
    roles: ["ADMINISTRATOR", "SUPPORT"],
  },
  {
    href: "/withdrawals",
    label: "Withdrawals",
    description: "Held funds and transfer approvals",
    roles: ["ADMINISTRATOR"],
  },
  {
    href: "/agents",
    label: "Agents",
    description: "Agent access and suspension",
    roles: ["ADMINISTRATOR"],
  },
]

export default async function DashboardPage() {
  const [sessionResponse, reportingResponse] = await Promise.all([
    apiRequest("/internal-auth/session", {}, true),
    apiRequest("/admin/reporting/overview", {}, true),
  ])

  if (sessionResponse.status === 401 || reportingResponse.status === 401) {
    redirect("/login")
  }

  const { operator } = (await apiJson(sessionResponse)) as DashboardSession
  const reporting = (await apiJson(
    reportingResponse
  )) as AdminReportingOverviewData
  const visible = quickLinks.filter((link) =>
    link.roles.includes(operator.role)
  )

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="Operations workspace"
        description="Live financial performance, fulfillment status, and operational queue metrics."
      />
      <section>
        <OperationsDashboard data={reporting} />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Quick links</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((link) => (
            <Link
              className="group rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              href={link.href}
              key={link.href}
            >
              <Card className="border-0 bg-transparent shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {link.label}
                    <HugeiconsIcon
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent-foreground"
                      icon={ArrowRight01Icon}
                    />
                  </CardTitle>
                  <CardDescription className="leading-6">
                    {link.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
