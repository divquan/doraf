import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment';
import { AesGcmVoucherCrypto } from '../inventory/aes-gcm-voucher.crypto';
import { MasterKeyVoucherKeyProvider } from '../inventory/master-key-voucher-key.provider';
import { VoucherRevealService } from './voucher-reveal.service';

describe('VoucherRevealService', () => {
  it('unwraps the batch key and authenticates both voucher fields', async () => {
    const masterKey = Buffer.alloc(32, 41);
    const keyProvider = new MasterKeyVoucherKeyProvider(masterKey);
    const crypto = new AesGcmVoucherCrypto(keyProvider, Buffer.alloc(32, 42));
    const batchKey = await keyProvider.createBatchKey();
    const voucher = {
      id: '00000000-0000-4000-8000-000000000041',
      productId: '00000000-0000-4000-8000-000000000042',
      batchId: '00000000-0000-4000-8000-000000000043',
      cryptoVersion: 1,
      batch: { encryptedDataKey: batchKey.encryptedDataKey },
    };
    const context = (field: 'serial' | 'pin') =>
      `dashchecker:voucher:${voucher.id}:${voucher.productId}:${voucher.batchId}:${field}:v1`;
    const serial = crypto.encrypt(
      'SERIAL-RECOVERY-41',
      batchKey.plaintextKey,
      context('serial'),
    );
    const pin = crypto.encrypt(
      '012345678912',
      batchKey.plaintextKey,
      context('pin'),
    );
    const config = {
      getOrThrow: jest.fn(() => masterKey.toString('base64')),
    } as unknown as ConfigService<AppEnvironment, true>;
    const service = new VoucherRevealService(config);

    expect(
      service.reveal({
        ...voucher,
        serialCiphertext: serial.ciphertext,
        serialNonce: serial.nonce,
        serialAuthTag: serial.authTag,
        pinCiphertext: pin.ciphertext,
        pinNonce: pin.nonce,
        pinAuthTag: pin.authTag,
      }),
    ).toEqual({
      serialNumber: 'SERIAL-RECOVERY-41',
      pin: '012345678912',
    });
  });
});
