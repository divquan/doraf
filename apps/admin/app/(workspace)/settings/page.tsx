import { redirect } from "next/navigation"
import { OperatorIdentityCard } from "@/components/_workspace/operator-identity-card"
import { PageHeader } from "@/components/_workspace/page-header"
import { ThemeSelector } from "@/components/_workspace/theme-selector"
import { apiJson, apiRequest } from "@/lib/internal-api"
import type { AdminRole } from "@/components/_workspace/workspace-sidebar"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

interface SettingsSession {
  operator: {
    id: string
    displayName: string
    role: AdminRole
  }
}

export default async function SettingsPage() {
  const sessionRes = await apiRequest("/internal-auth/session", {}, true)

  if (sessionRes.status === 401) {
    redirect("/login")
  }

  const { operator } = (await apiJson(sessionRes)) as SettingsSession

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Operator identity and reserved administrative sections."
      />
      <section>
        <OperatorIdentityCard
          displayName={operator.displayName}
          role={operator.role}
        />
      </section>
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription className="leading-6">
              Choose how the administration workspace looks. System follows your
              device setting.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <ThemeSelector />
          </div>
        </Card>
      </section>
      <section className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Exports</CardTitle>
            <CardDescription className="leading-6">
              Not yet available — deferred.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Audit explorer</CardTitle>
            <CardDescription className="leading-6">
              Authorized administrators only — coming.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    </div>
  )
}
