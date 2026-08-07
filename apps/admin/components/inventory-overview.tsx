import Link from "next/link"
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
import { formatCount, formatDateTime, formatMoney } from "@/lib/format"
import type { AdminViewerRole, PricingProduct } from "@/lib/pricing"
import { InventoryProductCard } from "./inventory-product-card"

export interface InventoryOverviewData {
  products: Array<{
    id: string
    code: string
    name: string
    status: "ACTIVE" | "UNAVAILABLE"
    counts: {
      total: number
      available: number
      reserved: number
      sold: number
      quarantined: number
      void: number
      replaced: number
      refunded: number
    }
  }>
  batches: Array<{
    id: string
    product: { id: string; code: string; name: string }
    vendorName: string
    vendorReference: string
    acquisitionDate: string
    unitAcquisitionCostMinor: number
    currency: string
    sourceRowCount: number
    acceptedRowCount: number
    importedAt: string
    uploader: { displayName: string } | null
  }>
}

export function InventoryOverview({
  data,
  viewerRole,
  pricingProducts,
}: {
  data: InventoryOverviewData
  viewerRole: AdminViewerRole
  pricingProducts: PricingProduct[]
}) {
  const policyByProduct = new Map(
    pricingProducts.map((product) => [product.id, product.policy])
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {data.products.map((product) => (
          <InventoryProductCard
            key={product.id}
            policy={policyByProduct.get(product.id) ?? null}
            product={product}
            viewerRole={viewerRole}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent inventory batches</CardTitle>
          <CardDescription>
            The 25 most recent confirmed stock entries, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.batches.length === 0 ? (
            <Empty className="border py-12">
              <EmptyHeader>
                <EmptyTitle>No inventory batches yet</EmptyTitle>
                <EmptyDescription>
                  Confirm a manual inventory entry to start the batch history.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Unit cost</TableHead>
                  <TableHead>Entered by</TableHead>
                  <TableHead>Imported</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">
                      {batch.product.name}
                    </TableCell>
                    <TableCell>
                      <span className="block">{batch.vendorName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {batch.vendorReference}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCount(batch.acceptedRowCount)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatMoney(
                        batch.unitAcquisitionCostMinor,
                        batch.currency
                      )}
                    </TableCell>
                    <TableCell>
                      {batch.uploader?.displayName ?? "Former operator"}
                    </TableCell>
                    <TableCell>{formatDateTime(batch.importedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        href={`/inventory/batches/${batch.id}`}
                      >
                        View batch
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
