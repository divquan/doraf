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
          <Card key={product.id}>
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
            <CardContent className="space-y-4">
              <div>
                <p className="text-3xl font-semibold tabular-nums">
                  {formatCount(product.counts.available)}
                </p>
                <p className="text-sm text-muted-foreground">Available now</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-4 text-sm sm:grid-cols-4">
                <Count label="Reserved" value={product.counts.reserved} />
                <Count label="Sold" value={product.counts.sold} />
                <Count label="Quarantined" value={product.counts.quarantined} />
                <Count label="Void" value={product.counts.void} />
              </dl>
              <p className="text-xs text-muted-foreground">
                {formatCount(product.counts.total)} total ·{" "}
                {formatCount(product.counts.replaced)} replaced ·{" "}
                {formatCount(product.counts.refunded)} refunded
              </p>
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
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{formatCount(value)}</dd>
    </div>
  )
}

export function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
  }).format(value / 100)
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-GH").format(value)
}
