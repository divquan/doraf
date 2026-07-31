import { KeyManagementServiceClient } from '@google-cloud/kms';
import { randomBytes } from 'node:crypto';
import type { BatchDataKey, VoucherKeyProvider } from './inventory.types';

export class GcpKmsVoucherKeyProvider implements VoucherKeyProvider {
  constructor(
    private readonly keyName: string,
    private client?: KeyManagementServiceClient,
  ) {
    if (!keyName.startsWith('projects/')) {
      throw new Error(
        'Voucher KMS key name must be a full Google Cloud resource name',
      );
    }
  }

  async createBatchKey(): Promise<BatchDataKey> {
    this.client ??= new KeyManagementServiceClient();
    const plaintextKey = randomBytes(32);

    try {
      const [response] = await this.client.encrypt({
        name: this.keyName,
        plaintext: plaintextKey,
      });

      if (!response.ciphertext || !response.name) {
        throw new Error(
          'Google Cloud KMS returned an incomplete encryption result',
        );
      }

      return {
        plaintextKey,
        encryptedDataKey: Buffer.from(response.ciphertext),
        kmsKeyVersion: response.name,
        cryptoVersion: 1,
      };
    } catch (error: unknown) {
      plaintextKey.fill(0);
      throw error;
    }
  }
}
