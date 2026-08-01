import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  ReceiptTextIcon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
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
import { Separator } from "@workspace/ui/components/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { pesewasToGhs } from "@/lib/money-format"

export interface TransactionItem {
  id: string
  type: string
  amountMinor: string
  currency: string
  description: string
  createdAt: string
  orderReference?: string
}

export interface PaginationMetadata {
  totalItems: number
  totalPages: number
  currentPage: number
  limit: number
  hasNextPage: boolean
}

interface TransactionHistoryTableProps {
  items: TransactionItem[]
  pagination: PaginationMetadata
}

export function TransactionHistoryTable({
  items,
  pagination,
}: TransactionHistoryTableProps) {
  const { currentPage, totalPages, totalItems, hasNextPage } = pagination
  const hasPreviousPage = currentPage > 1

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl">Transaction history</CardTitle>
            <CardDescription>
              Detailed record of sale credits, adjustments, and reversals
            </CardDescription>
          </div>
          {totalItems > 0 ? (
            <Badge variant="outline">
              {totalItems} {totalItems === 1 ? "record" : "records"}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items.length === 0 ? (
          <Empty className="min-h-[180px]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={ReceiptTextIcon} strokeWidth={1.8} />
              </EmptyMedia>
              <EmptyTitle>No transactions yet</EmptyTitle>
              <EmptyDescription>
                Profit from completed voucher sales will appear here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">
                      Date & Time (GMT)
                    </TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const isCredit = !item.amountMinor.startsWith("-")
                    const formattedDate = formatAccraDate(item.createdAt)
                    const signPrefix = isCredit ? "+ " : "− "
                    const displayAmount = `${signPrefix}${pesewasToGhs(
                      item.amountMinor.replace("-", "")
                    )}`

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs font-medium whitespace-nowrap text-muted-foreground">
                          {formattedDate}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={isCredit ? "secondary" : "destructive"}
                            className="text-xs"
                          >
                            {isCredit ? "Credit" : "Debit"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {item.description}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono text-sm font-semibold whitespace-nowrap",
                            isCredit ? "text-foreground" : "text-destructive"
                          )}
                        >
                          {displayAmount}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 ? (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    {hasPreviousPage ? (
                      <Button
                        render={
                          <Link href={`?walletPage=${currentPage - 1}`} />
                        }
                        variant="outline"
                        size="sm"
                      >
                        <HugeiconsIcon
                          data-icon="inline-start"
                          icon={ArrowLeft02Icon}
                        />
                        Previous
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        <HugeiconsIcon
                          data-icon="inline-start"
                          icon={ArrowLeft02Icon}
                        />
                        Previous
                      </Button>
                    )}

                    {hasNextPage ? (
                      <Button
                        render={
                          <Link href={`?walletPage=${currentPage + 1}`} />
                        }
                        variant="outline"
                        size="sm"
                      >
                        Next
                        <HugeiconsIcon
                          data-icon="inline-end"
                          icon={ArrowRight02Icon}
                        />
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        Next
                        <HugeiconsIcon
                          data-icon="inline-end"
                          icon={ArrowRight02Icon}
                        />
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function formatAccraDate(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleString("en-GB", {
      timeZone: "Africa/Accra",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  } catch {
    return isoString
  }
}
