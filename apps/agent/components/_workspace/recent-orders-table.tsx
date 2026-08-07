"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ShoppingBag01Icon,
  ArrowLeft02Icon,
  ArrowRight02Icon,
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
import { pesewasToGhs, formatDate } from "@workspace/ui/lib/format"
import { cn } from "@workspace/ui/lib/utils"
import { PaginationMetadata } from "../transaction-history-table"

export interface AgentOrderItem {
  id: string
  publicReference: string
  productName: string
  quantity: number
  retailTotalMinor: string
  agentProfitTotalMinor: string
  deliveryPhoneMask: string
  paymentState: string
  fulfillmentState: string
  createdAt: string
}

export function RecentOrdersTable({
  orders,
  pagination,
  title = "Recent Orders",
  description = "Real-time history of customer voucher purchases.",
  viewAllHref,
  hideHeader = false,
}: {
  orders: AgentOrderItem[]
  pagination?: PaginationMetadata
  title?: string
  description?: string
  viewAllHref?: string
  hideHeader?: boolean
}) {
  const totalCount = pagination?.totalItems ?? orders.length
  const totalPages = pagination?.totalPages ?? 1
  const currentPage = pagination?.currentPage ?? 1
  const hasPreviousPage = currentPage > 1
  const hasNextPage = pagination?.hasNextPage ?? false

  return (
    <Card className="w-full overflow-hidden">
      {!hideHeader ? (
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
          <div>
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          <div className="flex items-center gap-3">
            {viewAllHref ? (
              <Link
                href={viewAllHref}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <span>View all</span>
                <HugeiconsIcon icon={ArrowRight02Icon} className="size-3.5" />
              </Link>
            ) : null}
            {totalCount > 0 ? (
              <Badge variant="secondary" className="font-mono text-xs">
                {totalCount} {totalCount === 1 ? "order" : "orders"}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
      ) : null}
      <CardContent className="p-0">
        {orders.length === 0 ? (
          <Empty className="min-h-[200px]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={ShoppingBag01Icon} strokeWidth={1.5} />
              </EmptyMedia>
              <EmptyTitle>No customer orders yet</EmptyTitle>
              <EmptyDescription>
                Share your storefront link to start receiving customer orders.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {/* Desktop Table View (Hidden on mobile) */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Order Ref</TableHead>
                    <TableHead className="hidden md:table-cell">Customer</TableHead>
                    <TableHead>Item & Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Retail Total</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const isUnpaid = order.paymentState === "UNPAID"
                    return (
                      <TableRow
                        key={order.id}
                        className={cn(
                          "transition-colors",
                          isUnpaid &&
                            "bg-destructive/5 dark:bg-destructive/10"
                        )}
                      >
                        <TableCell>
                          <div className="font-mono text-xs font-medium text-foreground truncate max-w-[130px] lg:max-w-none">
                            {order.publicReference}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatDate(order.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                          {order.deliveryPhoneMask}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-foreground text-xs">
                            {order.productName}
                          </span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            × {order.quantity}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <PaymentBadge state={order.paymentState} />
                            <FulfillmentBadge state={order.fulfillmentState} />
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right font-medium text-xs">
                          {pesewasToGhs(order.retailTotalMinor)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right text-xs",
                            isUnpaid
                              ? "font-medium text-muted-foreground"
                              : "font-bold text-foreground"
                          )}
                        >
                          + {pesewasToGhs(order.agentProfitTotalMinor)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card List View (Visible only on mobile) */}
            <div className="block sm:hidden divide-y">
              {orders.map((order) => {
                const isUnpaid = order.paymentState === "UNPAID"
                return (
                  <div
                    key={order.id}
                    className={cn(
                      "flex flex-col gap-2 p-3.5",
                      isUnpaid && "bg-destructive/5 dark:bg-destructive/10"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono text-xs font-semibold text-foreground truncate">
                          {order.publicReference}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "text-xs shrink-0",
                          isUnpaid
                            ? "font-medium text-muted-foreground"
                            : "font-bold text-foreground"
                        )}
                      >
                        + {pesewasToGhs(order.agentProfitTotalMinor)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-border/40">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="font-medium text-foreground truncate">
                          {order.productName}
                        </span>
                        <span className="text-muted-foreground shrink-0">
                          × {order.quantity}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <PaymentBadge state={order.paymentState} />
                        <FulfillmentBadge state={order.fulfillmentState} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {totalPages > 1 ? (
              <div className="p-4 space-y-4">
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    {hasPreviousPage ? (
                      <Button
                        render={
                          <Link href={`?ordersPage=${currentPage - 1}`} />
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
                          <Link href={`?ordersPage=${currentPage + 1}`} />
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
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function PaymentBadge({ state }: { state: string }) {
  const isPaid = state === "PAID"
  const isUnpaid = state === "UNPAID"
  const label = isPaid ? "Paid" : isUnpaid ? "Unpaid" : state
  const variant = isPaid ? "secondary" : isUnpaid ? "destructive" : "outline"
  return (
    <Badge
      variant={variant}
      className="text-[10px] uppercase font-medium px-1.5 py-0"
    >
      {label}
    </Badge>
  )
}

function FulfillmentBadge({ state }: { state: string }) {
  const isFulfilled = state === "FULFILLED"
  return (
    <Badge variant={isFulfilled ? "outline" : "secondary"} className="text-[10px] uppercase font-medium px-1.5 py-0">
      {isFulfilled ? "Fulfilled" : state}
    </Badge>
  )
}
