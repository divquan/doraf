import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CsvInventoryParser, normalizeSerial } from './csv-inventory.parser';
import {
  InventoryImportValidationError,
  InventoryProductNotFoundError,
} from './inventory.errors';
import {
  INVENTORY_REPOSITORY,
  VOUCHER_CRYPTO,
  type CommittedInventoryBatch,
  type ImportInventoryCommand,
  type InventoryVoucherEntry,
  type InventoryPreview,
  type InventoryRepository,
  type InventoryValidationError,
  type PlainVoucherRow,
  type PreparedVoucher,
  type VoucherCrypto,
} from './inventory.types';

@Injectable()
export class InventoryImportService {
  constructor(
    private readonly parser: CsvInventoryParser,
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventory: InventoryRepository,
    @Inject(VOUCHER_CRYPTO)
    private readonly crypto: VoucherCrypto,
  ) {}

  async previewEntries(
    productId: string,
    entries: InventoryVoucherEntry[],
  ): Promise<InventoryPreview> {
    if (!(await this.inventory.productExists(productId))) {
      throw new InventoryProductNotFoundError(productId);
    }

    const parsed = this.parser.parse(entriesToCsv(entries));
    const errors = [...parsed.errors];
    const locallyValidRows = parsed.rows.filter(
      (row) => !errors.some((error) => error.rowNumber === row.rowNumber),
    );

    if (locallyValidRows.length > 0) {
      errors.push(...(await this.findExistingErrors(locallyValidRows)));
    }

    errors.sort(
      (left, right) =>
        left.rowNumber - right.rowNumber ||
        left.field.localeCompare(right.field),
    );

    return {
      valid: errors.length === 0,
      sourceRowCount: parsed.sourceRowCount,
      acceptedRowCount: Math.max(
        parsed.sourceRowCount - uniqueDataErrorRows(errors),
        0,
      ),
      errors,
    };
  }

  async importEntries(
    command: ImportInventoryCommand,
  ): Promise<CommittedInventoryBatch> {
    const preview = await this.previewEntries(
      command.productId,
      command.entries,
    );
    if (!preview.valid) {
      throw new InventoryImportValidationError(preview.errors);
    }

    const parsed = this.parser.parse(entriesToCsv(command.entries));
    const batchId = randomUUID();
    const batchKey = await this.crypto.createBatchKey();

    try {
      const vouchers = parsed.rows.map((row) =>
        this.prepareVoucher(command.productId, batchId, row, batchKey),
      );

      return await this.inventory.commitImport({
        batchId,
        productId: command.productId,
        vendorName: command.vendorName.trim(),
        vendorReference: command.vendorReference.trim(),
        acquisitionDate: command.acquisitionDate,
        unitAcquisitionCostMinor: command.unitAcquisitionCostMinor,
        uploadedByActorId: command.uploadedByActorId,
        actorRole: command.actorRole,
        authenticationStrength: command.authenticationStrength,
        reason: command.reason.trim(),
        requestId: command.requestId,
        encryptedDataKey: batchKey.encryptedDataKey,
        kmsKeyVersion: batchKey.kmsKeyVersion,
        cryptoVersion: batchKey.cryptoVersion,
        vouchers,
      });
    } finally {
      batchKey.plaintextKey.fill(0);
    }
  }

  private async findExistingErrors(
    rows: PlainVoucherRow[],
  ): Promise<InventoryValidationError[]> {
    const fingerprints = rows.map((row) => ({
      row,
      serial: this.crypto.fingerprintSerial(row.serialNumber),
      pin: this.crypto.fingerprintPin(row.pin),
    }));
    const matches = await this.inventory.findFingerprintMatches(
      fingerprints.map((item) => item.serial),
      fingerprints.map((item) => item.pin),
    );
    const errors: InventoryValidationError[] = [];

    for (const item of fingerprints) {
      if (matches.serialFingerprints.has(item.serial.toString('hex'))) {
        errors.push({
          rowNumber: item.row.rowNumber,
          field: 'serial_number',
          code: 'SERIAL_ALREADY_EXISTS',
          message: 'Serial number already exists in inventory.',
        });
      }
      if (matches.pinFingerprints.has(item.pin.toString('hex'))) {
        errors.push({
          rowNumber: item.row.rowNumber,
          field: 'pin',
          code: 'PIN_ALREADY_EXISTS',
          message: 'PIN already exists in inventory.',
        });
      }
    }

    return errors;
  }

  private prepareVoucher(
    productId: string,
    batchId: string,
    row: PlainVoucherRow,
    batchKey: Awaited<ReturnType<VoucherCrypto['createBatchKey']>>,
  ): PreparedVoucher {
    const id = randomUUID();
    const serialNumber = row.serialNumber.trim();
    const serial = this.crypto.encrypt(
      serialNumber,
      batchKey.plaintextKey,
      voucherContext(id, productId, batchId, 'serial', batchKey.cryptoVersion),
    );
    const pin = this.crypto.encrypt(
      row.pin,
      batchKey.plaintextKey,
      voucherContext(id, productId, batchId, 'pin', batchKey.cryptoVersion),
    );

    return {
      id,
      serialCiphertext: serial.ciphertext,
      serialNonce: serial.nonce,
      serialAuthTag: serial.authTag,
      serialFingerprint: this.crypto.fingerprintSerial(serialNumber),
      serialMask: maskSerial(normalizeSerial(serialNumber)),
      serialKeyVersion: batchKey.kmsKeyVersion,
      pinCiphertext: pin.ciphertext,
      pinNonce: pin.nonce,
      pinAuthTag: pin.authTag,
      pinFingerprint: this.crypto.fingerprintPin(row.pin),
      pinMask: maskPin(row.pin),
      pinKeyVersion: batchKey.kmsKeyVersion,
      cryptoVersion: batchKey.cryptoVersion,
    };
  }
}

function entriesToCsv(entries: InventoryVoucherEntry[]): string {
  return [
    'serial_number,pin',
    ...entries.map(
      (entry) => `${csvCell(entry.serialNumber)},${csvCell(entry.pin)}`,
    ),
  ].join('\n');
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function voucherContext(
  voucherId: string,
  productId: string,
  batchId: string,
  field: 'serial' | 'pin',
  cryptoVersion: number,
): string {
  return `dashchecker:voucher:${voucherId}:${productId}:${batchId}:${field}:v${cryptoVersion}`;
}

function maskSerial(serialNumber: string): string {
  return `${'*'.repeat(Math.max(serialNumber.length - 4, 4))}${serialNumber.slice(-4)}`;
}

function maskPin(pin: string): string {
  return `${'*'.repeat(8)}${pin.slice(-4)}`;
}

function uniqueDataErrorRows(errors: InventoryValidationError[]): number {
  return new Set(
    errors
      .filter((error) => error.rowNumber >= 2)
      .map((error) => error.rowNumber),
  ).size;
}
