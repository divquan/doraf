"use client"

import { useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { Store01Icon, ShoppingBag01Icon } from "@hugeicons/core-free-icons"
import { Badge } from "@workspace/ui/components/badge"
import { StoreEditor, type StorefrontData } from "@/components/store-editor"
import { type AgentPricingRow } from "@/components/pricing-grid"
import { RecentOrdersTable, type AgentOrderItem } from "./recent-orders-table"
import { PaginationMetadata } from "../transaction-history-table"

export function MyStoreTabPanel({
  channel,
  prices,
  readOnly,
  qrDataUrl,
  orders,
  ordersPagination,
  initialTab = "store",
}: {
  channel: StorefrontData
  prices: AgentPricingRow[]
  readOnly: boolean
  qrDataUrl: string | null
  orders: AgentOrderItem[]
  ordersPagination?: PaginationMetadata
  initialTab?: "store" | "orders"
}) {
  const [activeTab, setActiveTab] = useState<"store" | "orders">(initialTab)
  const totalOrders = ordersPagination?.totalItems ?? orders.length

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Tab Header Navigation */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab("store")}
          className={cn(
            "px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer outline-none -mb-[1px] flex items-center gap-2",
            activeTab === "store"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <HugeiconsIcon icon={Store01Icon} className="size-4" />
          <span>Storefront & Pricing</span>
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={cn(
            "px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer outline-none -mb-[1px] flex items-center gap-2",
            activeTab === "orders"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <HugeiconsIcon icon={ShoppingBag01Icon} className="size-4" />
          <span>Recent Orders</span>
          {totalOrders > 0 ? (
            <Badge variant="secondary" className="px-1.5 py-0.5 text-xs font-mono">
              {totalOrders}
            </Badge>
          ) : null}
        </button>
      </div>

      {/* Tab Content */}
      <div className="w-full">
        {activeTab === "store" ? (
          <StoreEditor
            initialData={channel}
            products={prices}
            readOnly={readOnly}
            qrDataUrl={qrDataUrl}
          />
        ) : (
          <RecentOrdersTable orders={orders} pagination={ordersPagination} />
        )}
      </div>
    </div>
  )
}
