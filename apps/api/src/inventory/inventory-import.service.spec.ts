import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AesGcmVoucherCrypto } from './aes-gcm-voucher.crypto';
import { CsvInventoryParser } from './csv-inventory.parser';
import { InventoryImportValidationError } from './inventory.errors';
import { InventoryImportService } from './inventory-import.service';
import {
  INVENTORY_REPOSITORY,
  VOUCHER_CRYPTO,
  type CommitInventoryInput,
  type InventoryRepository,
  type VoucherKeyProvider,
} from './inventory.types';

describe('InventoryImportService', () => {
  const productId = randomUUID();
  const actorId = randomUUID();
  let service: InventoryImportService;
  let commitImport: jest.MockedFunction<InventoryRepository['commitImport']>;
  let plaintextKey: Buffer;

  beforeEach(async () => {
    plaintextKey = Buffer.alloc(32, 7);
    commitImport = jest.fn((input: CommitInventoryInput) =>
      Promise.resolve({
        batchId: input.batchId,
        importedVoucherCount: input.vouchers.length,
      }),
    );
    const repository: InventoryRepository = {
      productExists: jest.fn().mockResolvedValue(true),
      findFingerprintMatches: jest.fn().mockResolvedValue({
        serialFingerprints: new Set<string>(),
        pinFingerprints: new Set<string>(),
      }),
      commitImport,
    };
    const keyProvider: VoucherKeyProvider = {
      createBatchKey: jest.fn().mockImplementation(() =>
        Promise.resolve({
          plaintextKey,
          encryptedDataKey: Buffer.from('wrapped-test-key'),
          kmsKeyVersion:
            'projects/test/locations/global/keyRings/test/cryptoKeys/voucher/cryptoKeyVersions/1',
          cryptoVersion: 1,
        }),
      ),
    };
    const crypto = new AesGcmVoucherCrypto(keyProvider, Buffer.alloc(32, 11));
    const module = await Test.createTestingModule({
      providers: [
        CsvInventoryParser,
        InventoryImportService,
        { provide: INVENTORY_REPOSITORY, useValue: repository },
        { provide: VOUCHER_CRYPTO, useValue: crypto },
      ],
    }).compile();

    service = module.get(InventoryImportService);
  });

  it('encrypts and commits a completely valid batch once', async () => {
    const result = await service.importEntries({
      productId,
      vendorName: 'Authorized Vendor',
      vendorReference: 'INV-2026-001',
      acquisitionDate: new Date('2026-07-30T00:00:00Z'),
      unitAcquisitionCostMinor: 1_500n,
      uploadedByActorId: actorId,
      actorRole: 'ADMINISTRATOR',
      authenticationStrength: 'PHISHING_RESISTANT',
      reason: 'Load authorized WAEC inventory',
      requestId: randomUUID(),
      entries: [
        { serialNumber: 'SERIAL001', pin: '012345678912' },
        { serialNumber: 'SERIAL002', pin: '123456789012' },
      ],
    });

    expect(result.importedVoucherCount).toBe(2);
    expect(commitImport).toHaveBeenCalledTimes(1);
    const committed = commitImport.mock.calls[0]?.[0];
    expect(committed?.vouchers).toHaveLength(2);
    expect(committed?.vouchers[0]?.pinMask).toBe('********8912');
    expect(committed?.vouchers[0]?.pinFingerprint).toHaveLength(32);
    expect(
      committed?.vouchers[0]?.pinCiphertext.toString('utf8'),
    ).not.toContain('012345678912');
    expect(plaintextKey).toEqual(Buffer.alloc(32));
  });

  it('rejects the entire file before encryption or persistence', async () => {
    await expect(
      service.importEntries({
        productId,
        vendorName: 'Authorized Vendor',
        vendorReference: 'INV-2026-002',
        acquisitionDate: new Date('2026-07-30T00:00:00Z'),
        unitAcquisitionCostMinor: 1_500n,
        uploadedByActorId: actorId,
        actorRole: 'ADMINISTRATOR',
        authenticationStrength: 'PHISHING_RESISTANT',
        reason: 'Load authorized WAEC inventory',
        requestId: randomUUID(),
        entries: [
          { serialNumber: 'SERIAL001', pin: '012345678912' },
          { serialNumber: 'SERIAL001', pin: 'invalid' },
        ],
      }),
    ).rejects.toBeInstanceOf(InventoryImportValidationError);
    expect(commitImport).not.toHaveBeenCalled();
  });
});
