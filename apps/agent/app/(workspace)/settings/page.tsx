import { redirect } from "next/navigation"
import { PageHeader } from "@/components/_workspace/page-header"
import { AccountSummaryCard } from "@/components/_workspace/account-summary-card"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { apiJson, apiRequest } from "@/lib/agent-api"

import { ThemeSelector } from "@/components/_workspace/theme-selector"

interface AgentSession {
  agent: {
    id: string
    tenantId: string
    name: string
    phoneMask: string
    status: "ACTIVE" | "SUSPENDED"
  }
}

export default async function SettingsPage() {
  const sessionRes = await apiRequest("/agent-auth/session", {}, true)

  if (sessionRes.status === 401) {
    redirect("/login")
  }

  const { agent } = (await apiJson(sessionRes)) as AgentSession

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Manage your account profile, preferences, and security settings."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <AccountSummaryCard agent={agent} />
          
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Appearance & Theme</CardTitle>
              <CardDescription>
                Customize your agent workspace layout appearance.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ThemeSelector />
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                You can also cycle the layout mode immediately from any page using the <kbd className="font-semibold bg-muted px-1.5 py-0.5 rounded border text-[10px]">D</kbd> keyboard hotkey shortcut.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how and when you receive payouts and sale alerts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Notification controls are coming soon.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Data & Exports</CardTitle>
              <CardDescription>
                Request files of your transaction logs and sales history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Privacy-safe CSV data exports are not yet available (deferred).
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Legal & Terms</CardTitle>
              <CardDescription>
                View our service agreements and data privacy policies.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              <p>
                By using the Doraf Agent Workspace, you agree to our terms of service and compliance guidelines.
              </p>
              <div className="flex gap-4 font-medium text-primary">
                <a href="#terms" className="hover:underline">Terms of Service</a>
                <a href="#privacy" className="hover:underline">Privacy Policy</a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
