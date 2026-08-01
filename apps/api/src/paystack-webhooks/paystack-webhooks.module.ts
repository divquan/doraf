import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { WalletModule } from '../wallet/wallet.module';
import { PaystackWebhookController } from './paystack-webhook.controller';

@Module({
  imports: [PaymentsModule, WalletModule],
  controllers: [PaystackWebhookController],
})
export class PaystackWebhooksModule {}
