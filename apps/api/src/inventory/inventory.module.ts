import { DynamicModule, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment';
import { InternalAccessModule } from '../internal-access/internal-access.module';
import { AesGcmVoucherCrypto } from './aes-gcm-voucher.crypto';
import { CsvInventoryParser } from './csv-inventory.parser';
import { MasterKeyVoucherKeyProvider } from './master-key-voucher-key.provider';
import { InventoryImportService } from './inventory-import.service';
import { InventoryImportController } from './inventory-import.controller';
import { InventoryImportExceptionFilter } from './inventory-import-exception.filter';
import {
  INVENTORY_REPOSITORY,
  VOUCHER_CRYPTO,
  type VoucherCrypto,
} from './inventory.types';
import { PrismaInventoryRepository } from './prisma-inventory.repository';

@Module({})
export class InventoryModule {
  static register(crypto: VoucherCrypto): DynamicModule {
    const cryptoProvider: Provider = {
      provide: VOUCHER_CRYPTO,
      useValue: crypto,
    };

    return this.createModule(cryptoProvider);
  }

  static registerMasterKey(): DynamicModule {
    return this.createModule({
      provide: VOUCHER_CRYPTO,
      inject: [ConfigService],
      useFactory: (
        config: ConfigService<AppEnvironment, true>,
      ): VoucherCrypto => {
        const masterKeyBase64 = config.get('VOUCHER_MASTER_KEY_BASE64', {
          infer: true,
        });
        const fingerprintKeyBase64 = config.get(
          'VOUCHER_FINGERPRINT_KEY_BASE64',
          { infer: true },
        );

        return new AesGcmVoucherCrypto(
          new MasterKeyVoucherKeyProvider(
            Buffer.from(masterKeyBase64, 'base64'),
          ),
          Buffer.from(fingerprintKeyBase64, 'base64'),
        );
      },
    });
  }

  private static createModule(cryptoProvider: Provider): DynamicModule {
    return {
      module: InventoryModule,
      imports: [InternalAccessModule],
      controllers: [InventoryImportController],
      providers: [
        CsvInventoryParser,
        PrismaInventoryRepository,
        {
          provide: INVENTORY_REPOSITORY,
          useExisting: PrismaInventoryRepository,
        },
        cryptoProvider,
        InventoryImportService,
        InventoryImportExceptionFilter,
      ],
      exports: [InventoryImportService],
    };
  }
}
