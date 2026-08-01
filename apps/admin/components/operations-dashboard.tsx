import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export interface AdminReportingOverviewData {
  financial: {
    totalGrossSalesMinor: string
    totalAgentCommissionsMinor: string
    totalPlatformNetMinor: string
    totalActiveWalletBalancesMinor: string
    totalActiveHoldsMinor: string
    pendingWithdrawalCount: number
    pendingWithdrawalAmountMinor: string
  }
  fulfillment: {
    totalOrders: number
    paidOrders: number
    pendingOrders: number
    deliveriesCount: {
      pending: number
      submitted: number
      delivered: number
      failed: number
    }
    productSales: Array<{
      productCode: string
      productName: string
      soldCount: number
      availableStock: number
    }>
  }
  operations: {
    activeAgentCount: number
    suspendedAgentCount: number
    pendingOutboxCount: number
  }
}

export function OperationsDashboard({
  data,
}: {
  data: AdminReportingOverviewData
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Financial Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Gross Revenue"
          value={formatGhs(data.financial.totalGrossSalesMinor)}
          description="Total value of fulfilled paid sales"
        />
        <MetricCard
          label="Agent Commissions"
          value={formatGhs(data.financial.totalAgentCommissionsMinor)}
          description="Credited to agent wallets"
        />
        <MetricCard
          label="Net Revenue"
          value={formatGhs(data.financial.totalPlatformNetMinor)}
          description="Platform earnings after commissions"
        />
        <MetricCard
          label="Active Wallet Ledger"
          value={formatGhs(data.financial.totalActiveWalletBalancesMinor)}
          subText={`${formatGhs(data.financial.totalActiveHoldsMinor)} on hold`}
          description="Total funds in agent wallets"
        />
      </div>

      {/* Fulfillment & Operations Health */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order Fulfillment</CardTitle>
            <CardDescription>
              Public checkout activity across all channels
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <StatRow
              label="Total Orders"
              value={data.fulfillment.totalOrders.toLocaleString()}
            />
            <StatRow
              label="Paid & Fulfilled"
              value={data.fulfillment.paidOrders.toLocaleString()}
            />
            <StatRow
              label="Pending / Unpaid"
              value={data.fulfillment.pendingOrders.toLocaleString()}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery Dispatch Work</CardTitle>
            <CardDescription>
              SMS & Email voucher delivery states
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <StatRow
              label="Delivered"
              value={data.fulfillment.deliveriesCount.delivered.toLocaleString()}
            />
            <StatRow
              label="Submitted / In Flight"
              value={data.fulfillment.deliveriesCount.submitted.toLocaleString()}
            />
            <StatRow
              label="Pending Dispatch"
              value={data.fulfillment.deliveriesCount.pending.toLocaleString()}
            />
            {data.fulfillment.deliveriesCount.failed > 0 ? (
              <StatRow
                label="Failed Dispatches"
                value={data.fulfillment.deliveriesCount.failed.toLocaleString()}
                highlight
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operations & Agents</CardTitle>
            <CardDescription>Agent accounts and queue health</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <StatRow
              label="Active Agents"
              value={data.operations.activeAgentCount.toLocaleString()}
            />
            <StatRow
              label="Suspended Agents"
              value={data.operations.suspendedAgentCount.toLocaleString()}
            />
            <StatRow
              label="Pending Outbox Work"
              value={data.operations.pendingOutboxCount.toLocaleString()}
              highlight={data.operations.pendingOutboxCount > 10}
            />
            <StatRow
              label="Pending Withdrawals"
              value={`${data.financial.pendingWithdrawalCount} (${formatGhs(data.financial.pendingWithdrawalAmountMinor)})`}
            />
          </CardContent>
        </Card>
      </div>

      {/* Product Stock & Sales Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Product Inventory & Sales</CardTitle>
          <CardDescription>
            Live stock counts and total units sold per product
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {data.fulfillment.productSales.map((prod) => (
            <div
              key={prod.productCode}
              className="flex flex-col justify-between rounded-lg border p-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {prod.productName}
                  </span>
                  <Badge variant="outline">{prod.productCode}</Badge>
                </div>
                <p className="mt-3 text-2xl font-bold">
                  {prod.availableStock.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Available vouchers
                </p>
              </div>
              <p className="mt-4 border-t pt-2 text-xs font-medium text-muted-foreground">
                {prod.soldCount.toLocaleString()} vouchers sold
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  label,
  value,
  subText,
  description,
}: {
  label: string
  value: string
  subText?: string
  description: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-bold">{value}</CardTitle>
        {subText ? (
          <p className="text-xs font-medium text-muted-foreground">{subText}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function StatRow({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-semibold ${
          highlight ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function formatGhs(minorStr: string) {
  const minor = BigInt(minorStr)
  return `GHS ${(minor / 100n).toLocaleString("en-GH")}.${(minor % 100n)
    .toString()
    .padStart(2, "0")}`
}
