import { redirect } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  Link01Icon,
  SecurityCheckIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { DorafMark } from "@/components/doraf-mark"
import { LogoutButton } from "@/components/logout-button"
import { AgentPricingRow, PricingGrid } from "@/components/pricing-grid"
import { apiJson, apiRequest } from "@/lib/agent-api"

interface AgentSession {
  agent: {
    id: string
    tenantId: string
    name: string
    phoneMask: string
    status: "ACTIVE" | "SUSPENDED"
  }
}

const upcoming = [
  {
    icon: Link01Icon,
    title: "Your sales channels",
    description: "A permanent web link and USSD referral code.",
  },
  {
    icon: Wallet01Icon,
    title: "Sales and earnings",
    description: "Track orders, agent profit, and wallet activity.",
  },
]

export default async function DashboardPage() {
  const [response, pricesResponse] = await Promise.all([
    apiRequest("/agent-auth/session", {}, true),
    apiRequest("/agent-auth/prices", {}, true),
  ])
  if (response.status === 401) {
    redirect("/login")
  }
  const { agent } = (await apiJson(response)) as AgentSession
  const prices = (await apiJson(pricesResponse)) as AgentPricingRow[]
  const firstName = agent.name.split(/\s+/)[0] ?? agent.name

  return (
    <main className="min-h-svh bg-muted/35">
      <header className="border-b bg-background/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <DorafMark />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{agent.name}</p>
              <p className="text-xs text-muted-foreground">{agent.phoneMask}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
        <section className="flex flex-col gap-3">
          <Badge className="w-fit" variant="secondary">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} />
            Account ready
          </Badge>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Welcome, {firstName}.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-pretty text-muted-foreground">
            Set the final prices buyers see. Every price stays within
            Doraf&apos;s approved range, and your earnings update before you
            save.
          </p>
        </section>

        {agent.status === "SUSPENDED" ? (
          <Alert variant="destructive">
            <HugeiconsIcon icon={SecurityCheckIcon} />
            <AlertTitle>Your account is read-only</AlertTitle>
            <AlertDescription>
              You can review historical activity, but new sales and account
              changes are disabled while the account is suspended.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="space-y-4">
          <div>
            <h2 className="font-heading text-2xl font-semibold">
              Checker pricing
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              One price per checker across your web and USSD sales channels.
            </p>
          </div>
          <PricingGrid rows={prices} readOnly={agent.status === "SUSPENDED"} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                Finish setting up your workspace
              </CardTitle>
              <CardDescription>
                The account and secure sign-in are complete. Commercial setup is
                the next product slice.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {upcoming.map((item, index) => (
                <div key={item.title}>
                  <div className="flex items-start gap-4 py-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <HugeiconsIcon icon={item.icon} strokeWidth={1.8} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{item.title}</p>
                        <Badge variant="outline">Coming next</Badge>
                      </div>
                      <p className="text-sm leading-6 text-pretty text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  {index < upcoming.length - 1 ? <Separator /> : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>
                Your current account access details.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  Sign-in method
                </span>
                <span className="text-sm font-medium">SMS one-time code</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Phone</span>
                <span className="text-sm font-medium">{agent.phoneMask}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  Account status
                </span>
                <Badge
                  variant={
                    agent.status === "ACTIVE" ? "secondary" : "destructive"
                  }
                >
                  {agent.status === "ACTIVE" ? "Active" : "Suspended"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
