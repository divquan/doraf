import { redirect } from "next/navigation"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  SecurityCheckIcon,
  ShoppingBag01Icon,
  Tag01Icon,
  MoneySend01Icon,
  Wallet01Icon,
  Calendar01Icon,
  ChartLineIcon,
  ArrowRight02Icon,
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
import { Button } from "@workspace/ui/components/button"
import { AgentPricingRow } from "@/components/pricing-grid"
import { EarningsSummary } from "@/components/earnings-balance-card"
import {
  RecentOrdersTable,
  AgentOrderItem,
} from "@/components/_workspace/recent-orders-table"
import { StoreShareBanner } from "@/components/_workspace/store-share-banner"
import {
  isPayoutDestination,
  PayoutDestinationData,
} from "@/components/_workspace/payout-destination"
import { pesewasToGhs } from "@workspace/ui/lib/format"
import { apiJson, apiRequest } from "@/lib/agent-api"
import { qrDataUrl } from "@/lib/qr"

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
  type: "WEB"
  subdomainUrl: string
  subdomain: string
}

interface SalesSummaryResponse {
  today: {
    orderCount: number
    unitsSold: number
    profitMinor: string
  }
  thisWeek: {
    orderCount: number
    unitsSold: number
    profitMinor: string
  }
  total: {
    orderCount: number
    unitsSold: number
    profitMinor: string
  }
}

interface PaginatedOrdersResponse {
  items: AgentOrderItem[]
}

export default async function DashboardPage() {
  const [
    sessionRes,
    pricesRes,
    channelRes,
    walletSummaryRes,
    salesSummaryRes,
    ordersRes,
    destinationRes,
  ] = await Promise.all([
    apiRequest("/agent-auth/session", {}, true),
    apiRequest("/agent-auth/prices", {}, true),
    apiRequest("/agent-auth/sales-channel", {}, true),
    apiRequest("/agent-wallet/summary", {}, true),
    apiRequest("/agent-auth/sales-summary", {}, true),
    apiRequest("/agent-auth/orders?page=1&limit=5", {}, true),
    apiRequest("/agent-wallet/payout-destination", {}, true),
  ])

  if (sessionRes.status === 401) {
    redirect("/login")
  }

  const { agent } = (await apiJson(sessionRes)) as AgentSession
  const prices = pricesRes.ok
    ? ((await apiJson(pricesRes)) as AgentPricingRow[])
    : []
  const channel = channelRes.ok
    ? ((await apiJson(channelRes)) as SalesChannel)
    : null
  const earningsSummary = walletSummaryRes.ok
    ? ((await apiJson(walletSummaryRes)) as EarningsSummary)
    : {
        withdrawableMinor: "0",
        ledgerBalanceMinor: "0",
        activeHoldsMinor: "0",
        currency: "GHS",
      }
  const salesSummary = salesSummaryRes.ok
    ? ((await apiJson(salesSummaryRes)) as SalesSummaryResponse)
    : {
        today: { orderCount: 0, unitsSold: 0, profitMinor: "0" },
        thisWeek: { orderCount: 0, unitsSold: 0, profitMinor: "0" },
        total: { orderCount: 0, unitsSold: 0, profitMinor: "0" },
      }
  const ordersData = ordersRes.ok
    ? ((await apiJson(ordersRes)) as PaginatedOrdersResponse)
    : { items: [] }
  const rawDestination = destinationRes.ok
    ? ((await apiJson(destinationRes)) as PayoutDestinationData | null)
    : null
  const destination = isPayoutDestination(rawDestination) ? rawDestination : null
  const firstName = agent.name.split(/\s+/)[0] ?? agent.name
  const salesUrl = channel?.subdomainUrl ?? ""
  const qr = salesUrl ? await qrDataUrl(salesUrl) : null

  const setPricesCount = prices.filter(
    (p) => p.pricing.retailPriceMinor !== null
  ).length
  const totalPricesCount = prices.length

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Welcome Header */}
      <section className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Welcome, {firstName}.
        </h1>
        <p className="text-sm text-muted-foreground">
          Track real-time sales velocity, share your storefront, and manage
          earnings.
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
              <a
                href="mailto:support@dashchecker.com?subject=Agent%20Account%20Suspension"
                className="hover:text-red-400"
              >
                Contact Support
              </a>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Hero Store Share Banner */}
      {salesUrl ? (
        <StoreShareBanner subdomainUrl={salesUrl} qrDataUrl={qr} />
      ) : null}

      {/* Dashboard Metrics Grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Available Payout */}
        <div className="flex flex-col justify-between gap-1 rounded-xl bg-muted/50 p-4">
          <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Available payout
          </span>
          <span className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {pesewasToGhs(earningsSummary.withdrawableMinor)}
          </span>
          <span className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {destination
                ? "Ready for transfer"
                : "Set up a destination to withdraw"}
            </span>
            <Link
              href="/earnings"
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              <span>Withdraw</span>
              <HugeiconsIcon icon={ArrowRight02Icon} className="size-3.5" />
            </Link>
          </span>
        </div>

        {/* Card 2: Today's Sales */}
        <div className="flex flex-col justify-between gap-1 rounded-xl bg-muted/50 p-4">
          <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Today's Sales
          </span>
          <span className="text-2xl font-bold tracking-tight text-foreground">
            {salesSummary.today.unitsSold}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              checkers
            </span>
          </span>
          <span className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Profit today</span>
            <span className="font-semibold text-foreground">
              + {pesewasToGhs(salesSummary.today.profitMinor)}
            </span>
          </span>
        </div>

        {/* Card 3: This Week's Sales */}
        <div className="flex flex-col justify-between gap-1 rounded-xl bg-muted/50 p-4">
          <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            This Week's Sales
          </span>
          <span className="text-2xl font-bold tracking-tight text-foreground">
            {salesSummary.thisWeek.unitsSold}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              checkers
            </span>
          </span>
          <span className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Profit this week</span>
            <span className="font-semibold text-foreground">
              + {pesewasToGhs(salesSummary.thisWeek.profitMinor)}
            </span>
          </span>
        </div>

        {/* Card 4: Total Earnings */}
        <div className="flex flex-col justify-between gap-1 rounded-xl bg-muted/50 p-4">
          <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Total Earnings
          </span>
          <span className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {pesewasToGhs(earningsSummary.ledgerBalanceMinor)}
          </span>
          <span className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Checkers sold</span>
            <span className="font-semibold text-foreground">
              {salesSummary.total.unitsSold} units
            </span>
          </span>
        </div>
      </section>

      {/* Main Dashboard Layout */}
      <div className="grid w-full gap-6 lg:grid-cols-12">
        {/* Left Column: Recent Purchases Table */}
        <section className="lg:col-span-7 xl:col-span-8">
          <RecentOrdersTable
            orders={ordersData.items}
            title="Recent Purchases"
            description="Live stream of customer orders placed via your store link."
            viewAllHref="/my-store?ordersPage=1"
          />
        </section>

        {/* Right Column: Payout Destination & Quick Shortcuts */}
        <section className="flex flex-col gap-6 lg:col-span-5 xl:col-span-4">
          {/* Payout Destination Card */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div>
                <CardTitle className="text-base font-semibold">
                  Payout Destination
                </CardTitle>
                <CardDescription className="text-xs">
                  Mobile Money account for earnings payouts.
                </CardDescription>
              </div>
              <Link
                href="/earnings"
                className="text-xs font-medium text-primary hover:underline"
              >
                Manage
              </Link>
            </CardHeader>
            <CardContent>
              {destination ? (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex flex-col gap-0.5">
                    <div className="text-xs font-semibold text-foreground">
                      {destination.network} • {destination.accountName}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {destination.phoneMask}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    Verified
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-foreground">
                      No payout destination yet
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Set up a Mobile Money account to receive payouts.
                    </span>
                  </div>
                  <Button
                    render={<Link href="/earnings" />}
                    size="sm"
                    variant="outline"
                  >
                    Set Up
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Shortcuts Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Quick Shortcuts
              </CardTitle>
              <CardDescription className="text-xs">
                Direct access to key workspace tools.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="flex items-center justify-between border-b py-2 last:border-0">
                <div className="flex items-center gap-3">
                  <HugeiconsIcon
                    icon={ShoppingBag01Icon}
                    className="size-4 text-muted-foreground"
                  />
                  <div>
                    <p className="text-xs leading-none font-medium">
                      My Store & Orders
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Storefront setup & order history
                    </p>
                  </div>
                </div>
                <Button
                  render={<Link href="/my-store" />}
                  size="sm"
                  variant="outline"
                >
                  Go
                </Button>
              </div>

              <div className="flex items-center justify-between border-b py-2 last:border-0">
                <div className="flex items-center gap-3">
                  <HugeiconsIcon
                    icon={Tag01Icon}
                    className="size-4 text-muted-foreground"
                  />
                  <div>
                    <p className="text-xs leading-none font-medium">
                      Pricing Setup
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {setPricesCount} of {totalPricesCount} checkers configured
                    </p>
                  </div>
                </div>
                <Button
                  render={<Link href="/pricing" />}
                  size="sm"
                  variant="outline"
                >
                  Edit
                </Button>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <HugeiconsIcon
                    icon={MoneySend01Icon}
                    className="size-4 text-muted-foreground"
                  />
                  <div>
                    <p className="text-xs leading-none font-medium">
                      Request Payout
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Transfer earnings to MoMo
                    </p>
                  </div>
                </div>
                {agent.status === "SUSPENDED" ? (
                  <Button disabled size="sm" variant="outline">
                    Request
                  </Button>
                ) : (
                  <Button
                    render={<Link href="/earnings" />}
                    size="sm"
                    variant="outline"
                  >
                    Request
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
