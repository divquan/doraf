"use client"

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { formatDateTime, formatMoney } from "@/lib/format"

export type OrderPaymentState =
  | "UNPAID"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "FULLY_REFUNDED"

export type OrderFulfillmentState =
  | "PENDING"
  | "COMPLETE"
  | "EXCEPTION"
  | "REFUNDED"
  | "PARTIALLY_REPLACED"

export interface AgentOrderItem {
  id: string
  publicReference: string
  productName: string
  quantity: number
  retailTotalMinor: string
  agentProfitTotalMinor: string
  deliveryPhoneMask: string
  paymentState: OrderPaymentState
  fulfillmentState: OrderFulfillmentState
  createdAt: string
}

export interface OrderPagination {
  totalItems: number
  totalPages: number
  currentPage: number
  limit: number
  hasNextPage: boolean
}

interface AgentOrdersTableProps {
  agentId: string
  items: AgentOrderItem[]
  pagination: OrderPagination
}

export function AgentOrdersTable({
  agentId,
  items,
  pagination,
}: AgentOrdersTableProps) {
  const { currentPage, totalPages, totalItems, hasNextPage } = pagination
  const hasPreviousPage = currentPage > 1

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Orders</CardTitle>
            <CardDescription>
              Every recorded order placed through this agent&apos;s sales
              channel.
            </CardDescription>
          </div>
          {totalItems > 0 ? (
            <Badge variant="outline">
              {totalItems} {totalItems === 1 ? "order" : "orders"}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items.length === 0 ? (
          <Empty className="min-h-48 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={ReceiptTextIcon} strokeWidth={1.8} />
              </EmptyMedia>
              <EmptyTitle>No orders yet</EmptyTitle>
              <EmptyDescription>
                Orders placed through this agent&apos;s channel will appear
                here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Date & Time</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">To agent</TableHead>
                    <TableHead className="text-right">Platform share</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Fulfilment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((order) => (
                    <OrderRow key={order.id} order={order} />
                  ))}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  {hasPreviousPage ? (
                    <Button
                      render={
                        <Link
                          href={`/agents/${agentId}?page=${currentPage - 1}`}
                        />
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <HugeiconsIcon
                        data-icon="inline-start"
                        icon={ArrowLeft02Icon}
                      />
                      Previous
                    </Button>
                  ) : (
                    <Button disabled size="sm" type="button" variant="outline">
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
                        <Link
                          href={`/agents/${agentId}?page=${currentPage + 1}`}
                        />
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Next
                      <HugeiconsIcon
                        data-icon="inline-end"
                        icon={ArrowRight02Icon}
                      />
                    </Button>
                  ) : (
                    <Button disabled size="sm" type="button" variant="outline">
                      Next
                      <HugeiconsIcon
                        data-icon="inline-end"
                        icon={ArrowRight02Icon}
                      />
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function OrderRow({ order }: { order: AgentOrderItem }) {
  const platformShareMinor = (
    BigInt(order.retailTotalMinor) - BigInt(order.agentProfitTotalMinor)
  ).toString()

  return (
    <TableRow>
      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
        {formatDateTime(order.createdAt)}
      </TableCell>
      <TableCell className="font-mono text-xs">
        {order.publicReference}
      </TableCell>
      <TableCell className="text-sm font-medium">{order.productName}</TableCell>
      <TableCell className="text-right tabular-nums">
        {order.quantity}
      </TableCell>
      <TableCell className="text-right font-mono font-semibold whitespace-nowrap">
        {formatMoney(order.agentProfitTotalMinor)}
      </TableCell>
      <TableCell className="text-right font-mono font-semibold whitespace-nowrap">
        {formatMoney(platformShareMinor)}
      </TableCell>
      <TableCell>
        <PaymentBadge state={order.paymentState} />
      </TableCell>
      <TableCell>
        <FulfilmentBadge state={order.fulfillmentState} />
      </TableCell>
    </TableRow>
  )
}

function PaymentBadge({ state }: { state: OrderPaymentState }) {
  return (
    <Badge
      variant={
        state === "PAID"
          ? "secondary"
          : state === "FULLY_REFUNDED"
            ? "destructive"
            : "outline"
      }
    >
      {paymentLabel(state)}
    </Badge>
  )
}

function paymentLabel(state: OrderPaymentState) {
  switch (state) {
    case "PAID":
      return "Paid"
    case "UNPAID":
      return "Unpaid"
    case "PARTIALLY_REFUNDED":
      return "Partial refund"
    case "FULLY_REFUNDED":
      return "Refunded"
  }
}

function FulfilmentBadge({ state }: { state: OrderFulfillmentState }) {
  return (
    <Badge
      variant={
        state === "COMPLETE"
          ? "secondary"
          : state === "EXCEPTION" || state === "REFUNDED"
            ? "destructive"
            : "outline"
      }
    >
      {fulfilmentLabel(state)}
    </Badge>
  )
}

function fulfilmentLabel(state: OrderFulfillmentState) {
  switch (state) {
    case "COMPLETE":
      return "Fulfilled"
    case "PENDING":
      return "Pending"
    case "EXCEPTION":
      return "Exception"
    case "REFUNDED":
      return "Refunded"
    case "PARTIALLY_REPLACED":
      return "Partially replaced"
  }
}
