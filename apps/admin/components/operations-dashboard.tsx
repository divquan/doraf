"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

export interface StuckOutboxDetailData {
  id: string
  eventType: string
  aggregateType: string
  aggregateId: string
  state: string
  lastError: string | null
  createdAt: string
}

export interface AdminReportingOverviewData {
  invariants?: {
    status: "HEALTHY" | "DISCREPANCY_DETECTED"
    auditedAt: string
    checks: Array<{
      code: string
      name: string
      status: "PASS" | "FAIL"
      details: string
      anomalyCount: number
      stuckEvents?: StuckOutboxDetailData[]
    }>
  }
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
  const router = useRouter()
  const [requeuing, setRequeuing] = useState(false)
  const [requeueMessage, setRequeueMessage] = useState<string | null>(null)

  const invariantStatus = data.invariants?.status ?? "HEALTHY"
  const outboxCheck = data.invariants?.checks.find(
    (c) => c.code === "OUTBOX_QUEUE_STUCK_WORK"
  )
  const stuckEvents = outboxCheck?.stuckEvents ?? []

  async function handleRequeue() {
    setRequeuing(true)
    setRequeueMessage(null)
    try {
      const response = await fetch("/api/reporting/requeue-outbox", {
        method: "POST",
      })
      const body = (await response.json().catch(() => ({}))) as {
        requeuedCount?: number
        message?: string
      }
      if (!response.ok) {
        throw new Error(body.message ?? "Failed to requeue stuck events")
      }
      setRequeueMessage(
        `Successfully requeued ${body.requeuedCount ?? 0} stuck outbox task(s).`
      )
      router.refresh()
    } catch (err) {
      setRequeueMessage(
        err instanceof Error ? err.message : "Requeue action failed"
      )
    } finally {
      setRequeuing(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* System Invariant & Health Status */}
      <Card
        className={
          invariantStatus === "DISCREPANCY_DETECTED"
            ? "border-destructive bg-destructive/5"
            : ""
        }
      >
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">
                Continuous System Invariant & Data Health
              </CardTitle>
              <CardDescription>
                Automated database checks across ledger, inventory stock, order items, and outbox queues
              </CardDescription>
            </div>
            <Badge
              variant={
                invariantStatus === "HEALTHY" ? "secondary" : "destructive"
              }
            >
              {invariantStatus === "HEALTHY"
                ? "All Invariants Healthy"
                : "Discrepancy Detected"}
            </Badge>
          </div>
        </CardHeader>
        {data.invariants?.checks && data.invariants.checks.length > 0 ? (
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.invariants.checks.map((check) => (
                <div
                  key={check.code}
                  className="flex flex-col justify-between rounded-md border p-3 text-xs"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{check.name}</span>
                      <Badge
                        variant={
                          check.status === "PASS" ? "outline" : "destructive"
                        }
                        className="text-[10px]"
                      >
                        {check.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-muted-foreground">{check.details}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Stuck Outbox Work Inspector */}
            {stuckEvents.length > 0 ? (
              <div className="mt-2 rounded-lg border bg-background p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-destructive">
                      Stuck Outbox Work Inspector ({stuckEvents.length} queued)
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Tasks pending &gt; 10 minutes without completion. Re-queue to trigger background workers.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={requeuing}
                    onClick={handleRequeue}
                    variant="outline"
                  >
                    {requeuing ? <Spinner data-icon="inline-start" /> : null}
                    Re-queue Stuck Tasks
                  </Button>
                </div>

                {requeueMessage ? (
                  <p className="text-xs font-medium text-primary">
                    {requeueMessage}
                  </p>
                ) : null}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Event Type</TableHead>
                      <TableHead className="text-xs">Aggregate ID</TableHead>
                      <TableHead className="text-xs">State</TableHead>
                      <TableHead className="text-xs">Created</TableHead>
                      <TableHead className="text-xs">Last Error / Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stuckEvents.map((evt) => (
                      <TableRow key={evt.id} className="text-xs">
                        <TableCell className="font-mono font-medium">
                          {evt.eventType}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {evt.aggregateId.slice(0, 18)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {evt.state}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(evt.createdAt)}</TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {evt.lastError ?? "Awaiting worker dispatch"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}
