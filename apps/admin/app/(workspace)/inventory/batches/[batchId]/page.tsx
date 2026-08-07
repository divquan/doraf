import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { formatDateTime, formatMoney } from "@/lib/format"
import { ApiError, apiJson, apiRequest } from "@/lib/internal-api"

interface InventoryBatchDetail {
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
  vouchers: Array<{
    id: string
    serialMask: string
    pinMask: string
    availability: "AVAILABLE" | "RESERVED" | "SOLD" | "QUARANTINED" | "VOID"
    disputeDisposition: "NONE" | "REPLACED" | "REFUNDED"
    createdAt: string
  }>
}

export default async function InventoryBatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>
}) {
  const { batchId } = await params
  const response = await apiRequest(
    `/admin/inventory/batches/${encodeURIComponent(batchId)}`,
    {},
    true
  )
  if (response.status === 401) redirect("/login")
  if (response.status === 404) notFound()

  let batch: InventoryBatchDetail
  try {
    batch = (await apiJson(response)) as InventoryBatchDetail
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-8 p-6 md:p-10">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Link
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href="/inventory"
          >
            ← Back to inventory
          </Link>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {batch.product.name} · {batch.product.code}
            </p>
            <h1 className="font-heading text-4xl">Inventory batch</h1>
          </div>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{batch.vendorName}</CardTitle>
          <CardDescription>{batch.vendorReference}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Detail
              label="Accepted units"
              value={String(batch.acceptedRowCount)}
            />
            <Detail
              label="Unit acquisition cost"
              value={formatMoney(
                batch.unitAcquisitionCostMinor,
                batch.currency
              )}
            />
            <Detail label="Acquisition date" value={batch.acquisitionDate} />
            <Detail label="Imported" value={formatDateTime(batch.importedAt)} />
            <Detail
              label="Entered by"
              value={batch.uploader?.displayName ?? "Former operator"}
            />
            <Detail label="Source rows" value={String(batch.sourceRowCount)} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Voucher entries</CardTitle>
          <CardDescription>
            Credentials remain encrypted. Only masked values are shown here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serial number</TableHead>
                <TableHead>PIN</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Dispute</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.vouchers.map((voucher) => (
                <TableRow key={voucher.id}>
                  <TableCell className="font-mono">
                    {voucher.serialMask}
                  </TableCell>
                  <TableCell className="font-mono">{voucher.pinMask}</TableCell>
                  <TableCell>
                    <StateBadge value={voucher.availability} />
                  </TableCell>
                  <TableCell>
                    {voucher.disputeDisposition === "NONE"
                      ? "—"
                      : titleCase(voucher.disputeDisposition)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}

function StateBadge({ value }: { value: string }) {
  return (
    <Badge
      variant={
        value === "AVAILABLE"
          ? "secondary"
          : value === "QUARANTINED" || value === "VOID"
            ? "destructive"
            : "outline"
      }
    >
      {titleCase(value)}
    </Badge>
  )
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase()
}
