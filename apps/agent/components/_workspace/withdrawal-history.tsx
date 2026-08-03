"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ReceiptTextIcon } from "@hugeicons/core-free-icons"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { pesewasToGhs, formatDate } from "@workspace/ui/lib/format"
import { type AgentWithdrawal, type WithdrawalState } from "../withdrawal-panel"

export function WithdrawalHistory({
  withdrawals,
}: {
  withdrawals: AgentWithdrawal[]
}) {
  return (
    <Card className="overflow-hidden border-border/75 shadow-sm">
      <CardHeader className="flex-row items-center justify-between gap-4 border-b bg-muted/20">
        <div>
          <CardTitle className="text-xl">Withdrawal history</CardTitle>
          <CardDescription>
            History of your Mobile Money payout requests.
          </CardDescription>
        </div>
        {withdrawals.length > 0 ? (
          <Badge variant="outline">
            {withdrawals.length}{" "}
            {withdrawals.length === 1 ? "request" : "requests"}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {withdrawals.length === 0 ? (
          <Empty className="min-h-[180px]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={ReceiptTextIcon} strokeWidth={1.8} />
              </EmptyMedia>
              <EmptyTitle>No withdrawals yet</EmptyTitle>
              <EmptyDescription>
                Your requests will appear here after SMS verification.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requested</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.map((withdrawal) => (
                <TableRow key={withdrawal.id}>
                  <TableCell>{formatDate(withdrawal.requestedAt)}</TableCell>
                  <TableCell>
                    {withdrawal.destinationMask}
                    <span className="block text-xs text-muted-foreground">
                      {networkLabel(withdrawal.network)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge state={withdrawal.state} />
                    {withdrawal.decisionReason ? (
                      <span className="mt-1 block max-w-48 text-xs whitespace-normal text-muted-foreground">
                        {withdrawal.decisionReason}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {pesewasToGhs(withdrawal.netAmountMinor)}
                    <span className="block text-xs font-normal text-muted-foreground">
                      + {pesewasToGhs(withdrawal.feeAmountMinor)} fee
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ state }: { state: WithdrawalState }) {
  const terminalFailure = ["REJECTED", "CANCELLED", "FAILED"].includes(state)
  return (
    <Badge
      variant={
        state === "SUCCESS"
          ? "secondary"
          : terminalFailure
            ? "destructive"
            : "outline"
      }
      className={statusBadgeVariant(state)}
    >
      {statusLabel(state)}
    </Badge>
  )
}

function networkLabel(network: string) {
  return network === "MTN"
    ? "MTN MoMo"
    : network === "TELECEL"
      ? "Telecel Cash"
      : "AT Money"
}

function statusLabel(state: WithdrawalState) {
  const labels: Record<WithdrawalState, string> = {
    REQUESTED: "Awaiting review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
    AWAITING_MERCHANT_OTP: "Awaiting transfer approval",
    SUBMITTED: "Submitted",
    PENDING: "Processing",
    SUCCESS: "Paid",
    FAILED: "Failed",
    REVERSED: "Reversed",
  }
  return labels[state] ?? state
}

function statusBadgeVariant(state: WithdrawalState): string | undefined {
  if (state === "SUCCESS") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 hover:bg-emerald-500/10"
  if (state === "REQUESTED") return "bg-amber-500/10 text-amber-700 border-amber-500/20 hover:bg-amber-500/10"
  return undefined
}
