import { redirect } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  SecurityCheckIcon,
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
import { SalesLinkCard } from "@/components/sales-link-card"
import {
  TransactionHistoryTable,
  TransactionItem,
  PaginationMetadata,
} from "@/components/transaction-history-table"
import {
  WalletBalanceCard,
  WalletSummary,
} from "@/components/wallet-balance-card"
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

interface SalesChannel {
  publicId: string
  path: string
  type: "WEB"
}

const MAX_WALLET_TRANSACTION_PAGE = 10_000

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const query = await searchParams
  const walletPage = getWalletPage(query.walletPage)

  const [sessionRes, pricesRes, channelRes, walletSummaryRes, transactionsRes] =
    await Promise.all([
      apiRequest("/agent-auth/session", {}, true),
      apiRequest("/agent-auth/prices", {}, true),
      apiRequest("/agent-auth/sales-channel", {}, true),
      apiRequest("/agent-wallet/summary", {}, true),
      apiRequest(`/agent-wallet/transactions?page=${walletPage}`, {}, true),
    ])

  if (sessionRes.status === 401) {
    redirect("/login")
  }

  const { agent } = (await apiJson(sessionRes)) as AgentSession
  const prices = (await apiJson(pricesRes)) as AgentPricingRow[]
  const channel = (await apiJson(channelRes)) as SalesChannel
  const walletSummary = (await apiJson(walletSummaryRes)) as WalletSummary
  const transactionsData = (await apiJson(transactionsRes)) as {
    items: TransactionItem[]
    pagination: PaginationMetadata
  }

  const salesUrl = new URL(
    channel.path,
    process.env.DORAF_AGENT_WEB_URL ?? "http://localhost:3002"
  ).toString()
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
            Manage your checker prices, track wallet earnings, and review your
            complete transaction history.
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

        <section>
          <WalletBalanceCard summary={walletSummary} />
        </section>

        <section>
          <TransactionHistoryTable
            items={transactionsData.items}
            pagination={transactionsData.pagination}
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div>
              <h2 className="font-heading text-2xl font-semibold">
                Checker pricing
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                One price per checker across your web and USSD sales channels.
              </p>
            </div>
            <PricingGrid
              rows={prices}
              readOnly={agent.status === "SUSPENDED"}
            />
          </div>

          <div className="flex flex-col gap-5">
            <SalesLinkCard
              readOnly={agent.status === "SUSPENDED"}
              salesUrl={salesUrl}
            />

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
          </div>
        </section>
      </div>
    </main>
  )
}

function getWalletPage(value: string | string[] | undefined): number {
  const page = Array.isArray(value) ? value[0] : value

  if (!page || !/^[1-9]\d*$/.test(page)) {
    return 1
  }

  const parsed = Number(page)
  if (!Number.isSafeInteger(parsed)) {
    return MAX_WALLET_TRANSACTION_PAGE
  }

  return Math.min(parsed, MAX_WALLET_TRANSACTION_PAGE)
}
