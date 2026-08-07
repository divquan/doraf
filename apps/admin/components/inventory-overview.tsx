import Link from "next/link"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardAction,
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
import { formatDateTime, formatMoney } from "@/lib/format"

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

export function InventoryOverview({ data }: { data: InventoryOverviewData }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {data.products.map((product) => (
          <Card key={product.id} size="sm">
            <CardHeader>
              <CardTitle>{product.name}</CardTitle>
              <CardDescription>{product.code}</CardDescription>
              <CardAction>
                <Badge
                  variant={
                    product.status === "ACTIVE" ? "secondary" : "outline"
                  }
                >
                  {product.status === "ACTIVE" ? "Active" : "Unavailable"}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold tabular-nums">
                  {formatCount(product.counts.available)}
                </p>
                <p className="text-sm text-muted-foreground">available now</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3 text-sm">
                <Count label="Reserved" value={product.counts.reserved} />
                <Count label="Sold" value={product.counts.sold} />
                <Count label="Quarantined" value={product.counts.quarantined} />
                <Count label="Void" value={product.counts.void} />
                <Count label="Replaced" value={product.counts.replaced} />
                <Count label="Refunded" value={product.counts.refunded} />
                <Count label="Total" value={product.counts.total} />
              </div>
            </CardContent>
          </Card>
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

function Count({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{formatCount(value)}</span>
    </span>
  )
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-GH").format(value)
}
