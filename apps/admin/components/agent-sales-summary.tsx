import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { formatMoney } from "@/lib/format"

export interface SalesWindow {
  orderCount: number
  unitsSold: number
  agentProfitMinor: string
  platformProfitMinor: string
  retailTotalMinor: string
}

export interface AgentSalesSummary {
  today: SalesWindow
  thisWeek: SalesWindow
  total: SalesWindow
}

export function AgentSalesSummaryGrid({
  summary,
}: {
  summary: AgentSalesSummary
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <SalesWindowCard label="Today" window={summary.today} />
      <SalesWindowCard label="This week" window={summary.thisWeek} />
      <SalesWindowCard label="All time" window={summary.total} />
    </div>
  )
}

function SalesWindowCard({
  label,
  window,
}: {
  label: string
  window: SalesWindow
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>
          {window.orderCount} {window.orderCount === 1 ? "order" : "orders"} ·{" "}
          {window.unitsSold} {window.unitsSold === 1 ? "unit" : "units"} sold
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <StatRow
          label="Made for the platform"
          value={formatMoney(window.platformProfitMinor)}
        />
        <StatRow
          label="Agent profit"
          value={formatMoney(window.agentProfitMinor)}
        />
        <StatRow
          label="Gross sales value"
          value={formatMoney(window.retailTotalMinor)}
        />
      </CardContent>
    </Card>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}
