import { Injectable, NotFoundException } from '@nestjs/common';
import {
  VoucherAvailability,
  VoucherDisputeDisposition,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

const RECENT_BATCH_LIMIT = 25;

@Injectable()
export class InventoryReadService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [products, availabilityGroups, dispositionGroups, batches] =
      await Promise.all([
        this.prisma.product.findMany({
          orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
          select: { id: true, code: true, name: true, status: true },
        }),
        this.prisma.voucher.groupBy({
          by: ['productId', 'availability'],
          _count: { _all: true },
        }),
        this.prisma.voucher.groupBy({
          by: ['productId', 'disputeDisposition'],
          _count: { _all: true },
        }),
        this.prisma.inventoryBatch.findMany({
          orderBy: [{ importedAt: 'desc' }, { id: 'desc' }],
          take: RECENT_BATCH_LIMIT,
          select: {
            id: true,
            vendorName: true,
            vendorReference: true,
            acquisitionDate: true,
            unitAcquisitionCostMinor: true,
            currency: true,
            sourceRowCount: true,
            acceptedRowCount: true,
            uploadedByActorId: true,
            importedAt: true,
            product: { select: { id: true, code: true, name: true } },
          },
        }),
      ]);

    const uploaders = await this.getUploaderNames(
      batches.map((batch) => batch.uploadedByActorId),
    );

    return {
      products: products.map((product) => {
        const counts = emptyCounts();
        for (const group of availabilityGroups) {
          if (group.productId !== product.id) continue;
          counts[availabilityKey(group.availability)] = group._count._all;
          counts.total += group._count._all;
        }
        for (const group of dispositionGroups) {
          if (group.productId !== product.id) continue;
          const key = dispositionKey(group.disputeDisposition);
          if (key) counts[key] = group._count._all;
        }
        return { ...product, counts };
      }),
      batches: batches.map((batch) => ({
        id: batch.id,
        product: batch.product,
        vendorName: batch.vendorName,
        vendorReference: batch.vendorReference,
        acquisitionDate: dateOnly(batch.acquisitionDate),
        unitAcquisitionCostMinor: Number(batch.unitAcquisitionCostMinor),
        currency: batch.currency,
        sourceRowCount: batch.sourceRowCount,
        acceptedRowCount: batch.acceptedRowCount,
        importedAt: batch.importedAt.toISOString(),
        uploader: uploader(uploaders, batch.uploadedByActorId),
      })),
    };
  }

  async getBatch(batchId: string) {
    const batch = await this.prisma.inventoryBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        vendorName: true,
        vendorReference: true,
        acquisitionDate: true,
        unitAcquisitionCostMinor: true,
        currency: true,
        sourceRowCount: true,
        acceptedRowCount: true,
        uploadedByActorId: true,
        importedAt: true,
        product: { select: { id: true, code: true, name: true } },
        vouchers: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            serialMask: true,
            pinMask: true,
            availability: true,
            disputeDisposition: true,
            createdAt: true,
          },
        },
      },
    });
    if (!batch) throw new NotFoundException('Inventory batch not found');

    const uploaders = await this.getUploaderNames([batch.uploadedByActorId]);
    return {
      id: batch.id,
      product: batch.product,
      vendorName: batch.vendorName,
      vendorReference: batch.vendorReference,
      acquisitionDate: dateOnly(batch.acquisitionDate),
      unitAcquisitionCostMinor: Number(batch.unitAcquisitionCostMinor),
      currency: batch.currency,
      sourceRowCount: batch.sourceRowCount,
      acceptedRowCount: batch.acceptedRowCount,
      importedAt: batch.importedAt.toISOString(),
      uploader: uploader(uploaders, batch.uploadedByActorId),
      vouchers: batch.vouchers.map((voucher) => ({
        ...voucher,
        createdAt: voucher.createdAt.toISOString(),
      })),
    };
  }

  private async getUploaderNames(ids: string[]) {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return new Map<string, string>();
    const users = await this.prisma.internalUser.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, displayName: true },
    });
    return new Map(users.map((user) => [user.id, user.displayName]));
  }
}

function emptyCounts() {
  return {
    total: 0,
    available: 0,
    reserved: 0,
    sold: 0,
    quarantined: 0,
    void: 0,
    replaced: 0,
    refunded: 0,
  };
}

function availabilityKey(value: VoucherAvailability) {
  return value.toLowerCase() as Lowercase<VoucherAvailability>;
}

function dispositionKey(value: VoucherDisputeDisposition) {
  if (value === VoucherDisputeDisposition.NONE) return null;
  return value.toLowerCase() as 'replaced' | 'refunded';
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function uploader(names: Map<string, string>, id: string) {
  const displayName = names.get(id);
  return displayName ? { displayName } : null;
}
