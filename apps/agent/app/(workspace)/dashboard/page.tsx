import { redirect } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  SecurityCheckIcon,
  ShoppingBag01Icon,
  Tag01Icon,
  MoneySend01Icon,
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
import { buttonVariants, Button } from "@workspace/ui/components/button"
import { AgentPricingRow } from "@/components/pricing-grid"
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
import Link from "next/link"

interface AgentSession {
  agent: {
    id: string
    tenantId: string
    name: string
    phoneMask: string
    status: "ACTIVE" | "SUSPENDED"
  }
}

export default async function DashboardPage() {
  const [
    sessionRes,
    pricesRes,
    walletSummaryRes,
    transactionsRes,
  ] = await Promise.all([
    apiRequest("/agent-auth/session", {}, true),
    apiRequest("/agent-auth/prices", {}, true),
    apiRequest("/agent-wallet/summary", {}, true),
    apiRequest("/agent-wallet/transactions?page=1", {}, true),
  ])

  if (sessionRes.status === 401) {
    redirect("/login")
  }

  const { agent } = (await apiJson(sessionRes)) as AgentSession
  const prices = (await apiJson(pricesRes)) as AgentPricingRow[]
  const walletSummary = (await apiJson(walletSummaryRes)) as WalletSummary
  const transactionsData = (await apiJson(transactionsRes)) as {
    items: TransactionItem[]
    pagination: PaginationMetadata
  }

  const firstName = agent.name.split(/\s+/)[0] ?? agent.name

  // Derived dashboard metrics
  const setPricesCount = prices.filter(
    (p) => p.pricing.retailPriceMinor !== null
  ).length
  const totalPricesCount = prices.length

  // Sliced transactions (recent 5)
  const recentTransactions = transactionsData.items.slice(0, 5)
  const dashboardPagination: PaginationMetadata = {
    ...transactionsData.pagination,
    totalPages: 1, // hides pagination controls
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      {/* Welcome & Account Badge */}
      <section className="flex flex-col gap-3">
        <Badge className="w-fit" variant="secondary">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} />
          Account ready
        </Badge>
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Welcome, {firstName}.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-pretty text-muted-foreground">
          Review your business overview, monitor recent sales activity, and access quick actions.
        </p>
      </section>

      {/* Suspension Alert */}
      {agent.status === "SUSPENDED" ? (
        <Alert variant="destructive">
          <HugeiconsIcon icon={SecurityCheckIcon} />
          <AlertTitle>Your account is read-only</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              You can review historical activity, but new sales and account
              changes are disabled while the account is suspended.
            </p>
            <div className="flex gap-4 text-xs font-semibold underline underline-offset-2">
              <a href="mailto:support@doraf.com?subject=Agent%20Account%20Suspension" className="hover:text-red-400">
                Contact Support
              </a>
              <a href="#learn-more" className="hover:text-red-400">
                Learn More
              </a>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Wallet Balance Overview */}
      <section>
        <WalletBalanceCard summary={walletSummary} />
      </section>

      {/* Dashboard Sub-sections */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Left Column: Recent Transactions */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-2xl font-semibold">
                Recent Transactions
              </h2>
              <p className="text-sm text-muted-foreground">
                Your latest wallet ledger entries.
              </p>
            </div>
            <Link href="/wallet" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <TransactionHistoryTable
            items={recentTransactions}
            pagination={dashboardPagination}
          />
        </section>

        {/* Right Column: Quick Summaries & Action CTAs */}
        <section className="flex flex-col gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Direct shortcuts to manage your workspace.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Sales Link Shortcut */}
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <HugeiconsIcon icon={ShoppingBag01Icon} className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-tight">My Store</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Share store checkout link</p>
                  </div>
                </div>
                <Link
                  href="/sales"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Go
                </Link>
              </div>

              {/* Pricing Shortcut */}
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <HugeiconsIcon icon={Tag01Icon} className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-tight">Pricing Setup</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {setPricesCount} of {totalPricesCount} checkers configured
                    </p>
                  </div>
                </div>
                <Link
                  href="/pricing"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Edit
                </Link>
              </div>

              {/* Withdrawals Shortcut */}
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <HugeiconsIcon icon={MoneySend01Icon} className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-tight">Withdraw Funds</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Request Mobile Money payout</p>
                  </div>
                </div>
                {agent.status === "SUSPENDED" ? (
                  <Button disabled size="sm" variant="outline">
                    Withdraw
                  </Button>
                ) : (
                  <Link
                    href="/withdrawals"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Withdraw
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
