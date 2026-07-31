export const INVENTORY_REPOSITORY = Symbol('INVENTORY_REPOSITORY');
export const VOUCHER_CRYPTO = Symbol('VOUCHER_CRYPTO');

export type VoucherField = 'csv' | 'serial_number' | 'pin';

export type InventoryValidationCode =
  | 'INVALID_CSV'
  | 'INVALID_HEADER'
  | 'MISSING_SERIAL'
  | 'INVALID_SERIAL'
  | 'MISSING_PIN'
  | 'INVALID_PIN'
  | 'DUPLICATE_SERIAL_IN_FILE'
  | 'DUPLICATE_PIN_IN_FILE'
  | 'SERIAL_ALREADY_EXISTS'
  | 'PIN_ALREADY_EXISTS';

export interface InventoryValidationError {
  rowNumber: number;
  field: VoucherField;
  code: InventoryValidationCode;
  message: string;
}

export interface PlainVoucherRow {
  rowNumber: number;
  serialNumber: string;
  pin: string;
}

export interface InventoryPreview {
  valid: boolean;
  sourceRowCount: number;
  acceptedRowCount: number;
  errors: InventoryValidationError[];
}

export interface ImportInventoryCommand {
  productId: string;
  vendorName: string;
  vendorReference: string;
  acquisitionDate: Date;
  unitAcquisitionCostMinor: bigint;
  uploadedByActorId: string;
  actorRole: 'ADMINISTRATOR';
  authenticationStrength: 'PRIMARY' | 'MFA' | 'PHISHING_RESISTANT';
  reason: string;
  requestId: string;
  csv: string;
}

export interface BatchDataKey {
  plaintextKey: Buffer;
  encryptedDataKey: Buffer;
  kmsKeyVersion: string;
  cryptoVersion: number;
}

export interface EncryptedValue {
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
}

export interface VoucherCrypto {
  createBatchKey(): Promise<BatchDataKey>;
  fingerprintSerial(serialNumber: string): Buffer;
  fingerprintPin(pin: string): Buffer;
  encrypt(value: string, plaintextKey: Buffer, context: string): EncryptedValue;
}

export interface VoucherKeyProvider {
  createBatchKey(): Promise<BatchDataKey>;
}

export interface FingerprintMatches {
  serialFingerprints: Set<string>;
  pinFingerprints: Set<string>;
}

export interface PreparedVoucher {
  id: string;
  serialCiphertext: Buffer;
  serialNonce: Buffer;
  serialAuthTag: Buffer;
  serialFingerprint: Buffer;
  serialMask: string;
  serialKeyVersion: string;
  pinCiphertext: Buffer;
  pinNonce: Buffer;
  pinAuthTag: Buffer;
  pinFingerprint: Buffer;
  pinMask: string;
  pinKeyVersion: string;
  cryptoVersion: number;
}

export interface CommitInventoryInput {
  batchId: string;
  productId: string;
  vendorName: string;
  vendorReference: string;
  acquisitionDate: Date;
  unitAcquisitionCostMinor: bigint;
  uploadedByActorId: string;
  actorRole: 'ADMINISTRATOR';
  authenticationStrength: 'PRIMARY' | 'MFA' | 'PHISHING_RESISTANT';
  reason: string;
  requestId: string;
  encryptedDataKey: Buffer;
  kmsKeyVersion: string;
  cryptoVersion: number;
  vouchers: PreparedVoucher[];
}

export interface CommittedInventoryBatch {
  batchId: string;
  importedVoucherCount: number;
}

export interface InventoryRepository {
  productExists(productId: string): Promise<boolean>;
  findFingerprintMatches(
    serialFingerprints: Buffer[],
    pinFingerprints: Buffer[],
  ): Promise<FingerprintMatches>;
  commitImport(input: CommitInventoryInput): Promise<CommittedInventoryBatch>;
}
