import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { InventoryDuplicateConflictError } from './inventory.errors';
import type {
  CommitInventoryInput,
  CommittedInventoryBatch,
  FingerprintMatches,
  InventoryRepository,
} from './inventory.types';

@Injectable()
export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async productExists(productId: string): Promise<boolean> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    return product !== null;
  }

  async findFingerprintMatches(
    serialFingerprints: Buffer[],
    pinFingerprints: Buffer[],
  ): Promise<FingerprintMatches> {
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        OR: [
          {
            serialFingerprint: {
              in: serialFingerprints.map(toPrismaBytes),
            },
          },
          { pinFingerprint: { in: pinFingerprints.map(toPrismaBytes) } },
        ],
      },
      select: {
        serialFingerprint: true,
        pinFingerprint: true,
      },
    });

    return {
      serialFingerprints: new Set(
        vouchers.map((voucher) =>
          Buffer.from(voucher.serialFingerprint).toString('hex'),
        ),
      ),
      pinFingerprints: new Set(
        vouchers.map((voucher) =>
          Buffer.from(voucher.pinFingerprint).toString('hex'),
        ),
      ),
    };
  }

  async commitImport(
    input: CommitInventoryInput,
  ): Promise<CommittedInventoryBatch> {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          await transaction.inventoryBatch.create({
            data: {
              id: input.batchId,
              productId: input.productId,
              vendorName: input.vendorName,
              vendorReference: input.vendorReference,
              acquisitionDate: input.acquisitionDate,
              unitAcquisitionCostMinor: input.unitAcquisitionCostMinor,
              sourceRowCount: input.vouchers.length,
              acceptedRowCount: input.vouchers.length,
              encryptedDataKey: toPrismaBytes(input.encryptedDataKey),
              kmsKeyVersion: input.kmsKeyVersion,
              cryptoVersion: input.cryptoVersion,
              uploadedByActorId: input.uploadedByActorId,
            },
          });

          await transaction.voucher.createMany({
            data: input.vouchers.map((voucher) => ({
              id: voucher.id,
              batchId: input.batchId,
              productId: input.productId,
              serialCiphertext: toPrismaBytes(voucher.serialCiphertext),
              serialNonce: toPrismaBytes(voucher.serialNonce),
              serialAuthTag: toPrismaBytes(voucher.serialAuthTag),
              serialFingerprint: toPrismaBytes(voucher.serialFingerprint),
              serialMask: voucher.serialMask,
              serialKeyVersion: voucher.serialKeyVersion,
              pinCiphertext: toPrismaBytes(voucher.pinCiphertext),
              pinNonce: toPrismaBytes(voucher.pinNonce),
              pinAuthTag: toPrismaBytes(voucher.pinAuthTag),
              pinFingerprint: toPrismaBytes(voucher.pinFingerprint),
              pinMask: voucher.pinMask,
              pinKeyVersion: voucher.pinKeyVersion,
              cryptoVersion: voucher.cryptoVersion,
            })),
          });

          await transaction.inventoryEvent.createMany({
            data: input.vouchers.map((voucher) => ({
              voucherId: voucher.id,
              eventType: 'IMPORTED',
              previousAvailability: null,
              resultingAvailability: 'AVAILABLE',
              sourceType: 'INVENTORY_BATCH',
              sourceId: input.batchId,
              actorId: input.uploadedByActorId,
              safeMetadata: {
                batchId: input.batchId,
                productId: input.productId,
              },
            })),
          });

          return {
            batchId: input.batchId,
            importedVoucherCount: input.vouchers.length,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new InventoryDuplicateConflictError();
      }
      throw error;
    }
  }
}

function toPrismaBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(value);
}
