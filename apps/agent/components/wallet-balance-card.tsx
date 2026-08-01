import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
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
import { pesewasToGhs } from "@/lib/money-format"

export interface WalletSummary {
  ledgerBalanceMinor: string
  activeHoldsMinor: string
  withdrawableMinor: string
  currency: string
  isNegative: boolean
  negativeBalanceMinor: string
}

interface WalletBalanceCardProps {
  summary: WalletSummary
}

export function WalletBalanceCard({ summary }: WalletBalanceCardProps) {
  const ledgerFormatted = pesewasToGhs(summary.ledgerBalanceMinor)
  const withdrawableFormatted = pesewasToGhs(summary.withdrawableMinor)
  const holdsFormatted = pesewasToGhs(summary.activeHoldsMinor)

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2} />
            </div>
            <div>
              <CardTitle className="text-xl">Wallet balance</CardTitle>
              <CardDescription>
                Earnings from completed voucher sales
              </CardDescription>
            </div>
          </div>
          <Badge variant={summary.isNegative ? "destructive" : "secondary"}>
            <HugeiconsIcon icon={CheckmarkCircle02Icon} />
            {summary.isNegative ? "Debt balance" : "In good standing"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {summary.isNegative ? (
          <Alert variant="destructive">
            <HugeiconsIcon icon={AlertCircleIcon} />
            <AlertTitle>Negative balance</AlertTitle>
            <AlertDescription>
              Your wallet balance is currently {ledgerFormatted}. Future sale
              earnings will automatically apply toward this amount before funds
              become withdrawable.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-4">
            <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Total balance
            </span>
            <span className="text-2xl font-bold tracking-tight">
              {ledgerFormatted}
            </span>
            <span className="text-xs text-muted-foreground">
              Cumulative posted ledger sum
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-4">
            <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Available payout
            </span>
            <span className="text-2xl font-bold tracking-tight">
              {withdrawableFormatted}
            </span>
            <span className="text-xs text-muted-foreground">
              Withdrawable after holds
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-4">
            <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Active holds
            </span>
            <span className="text-2xl font-bold tracking-tight text-muted-foreground">
              {holdsFormatted}
            </span>
            <span className="text-xs text-muted-foreground">
              Pending withdrawal holds
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
