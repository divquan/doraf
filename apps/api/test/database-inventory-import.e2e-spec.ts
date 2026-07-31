import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AppEnvironment } from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';
import { AesGcmVoucherCrypto } from '../src/inventory/aes-gcm-voucher.crypto';
import { CsvInventoryParser } from '../src/inventory/csv-inventory.parser';
import { InventoryImportValidationError } from '../src/inventory/inventory.errors';
import { InventoryImportService } from '../src/inventory/inventory-import.service';
import {
  INVENTORY_REPOSITORY,
  VOUCHER_CRYPTO,
  type VoucherKeyProvider,
} from '../src/inventory/inventory.types';
import { PrismaInventoryRepository } from '../src/inventory/prisma-inventory.repository';

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for database inventory import tests',
  );
}

describe('inventory import transaction', () => {
  let module: TestingModule;
  let service: InventoryImportService;
  let prisma: PrismaService;
  let productId: string;

  beforeAll(async () => {
    const config = {
      get: jest.fn().mockReturnValue(databaseUrl),
    } as unknown as ConfigService<AppEnvironment, true>;
    const keyProvider: VoucherKeyProvider = {
      createBatchKey: jest.fn().mockImplementation(() =>
        Promise.resolve({
          plaintextKey: randomBytes(32),
          encryptedDataKey: randomBytes(48),
          kmsKeyVersion:
            'projects/test/locations/global/keyRings/test/cryptoKeys/voucher/cryptoKeyVersions/1',
          cryptoVersion: 1,
        }),
      ),
    };
    const crypto = new AesGcmVoucherCrypto(keyProvider, Buffer.alloc(32, 13));

    module = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useFactory: () => new PrismaService(config) },
        CsvInventoryParser,
        PrismaInventoryRepository,
        {
          provide: INVENTORY_REPOSITORY,
          useExisting: PrismaInventoryRepository,
        },
        { provide: VOUCHER_CRYPTO, useValue: crypto },
        InventoryImportService,
      ],
    }).compile();
    service = module.get(InventoryImportService);
    prisma = module.get(PrismaService);
    const product = await prisma.product.findUniqueOrThrow({
      where: { code: 'WASSCE' },
      select: { id: true },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await module.close();
  });

  it('atomically commits batch, vouchers, and import events', async () => {
    const result = await service.importCsv({
      productId,
      vendorName: 'Integration Test Vendor',
      vendorReference: `TEST-${randomUUID()}`,
      acquisitionDate: new Date('2026-07-30T00:00:00Z'),
      unitAcquisitionCostMinor: 1_500n,
      uploadedByActorId: randomUUID(),
      csv: [
        'serial_number,pin',
        `DB${randomUUID().replaceAll('-', '')},001111111111`,
        `DB${randomUUID().replaceAll('-', '')},002222222222`,
      ].join('\n'),
    });

    const [batch, voucherCount, eventCount] = await Promise.all([
      prisma.inventoryBatch.findUnique({ where: { id: result.batchId } }),
      prisma.voucher.count({ where: { batchId: result.batchId } }),
      prisma.inventoryEvent.count({
        where: { sourceType: 'INVENTORY_BATCH', sourceId: result.batchId },
      }),
    ]);

    expect(batch?.acceptedRowCount).toBe(2);
    expect(voucherCount).toBe(2);
    expect(eventCount).toBe(2);
  });

  it('creates no batch when any row is invalid', async () => {
    const before = await prisma.inventoryBatch.count();

    await expect(
      service.importCsv({
        productId,
        vendorName: 'Integration Test Vendor',
        vendorReference: `TEST-${randomUUID()}`,
        acquisitionDate: new Date('2026-07-30T00:00:00Z'),
        unitAcquisitionCostMinor: 1_500n,
        uploadedByActorId: randomUUID(),
        csv: 'serial_number,pin\nVALID123,not-a-pin',
      }),
    ).rejects.toBeInstanceOf(InventoryImportValidationError);

    await expect(prisma.inventoryBatch.count()).resolves.toBe(before);
  });
});
