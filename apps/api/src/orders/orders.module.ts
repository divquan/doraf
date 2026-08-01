import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { OperationsModule } from '../operations/operations.module';
import { InternalAccessModule } from '../internal-access/internal-access.module';
import { PaymentsModule } from '../payments/payments.module';
import { OrderProtectionModule } from './order-protection.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    OperationsModule,
    InternalAccessModule,
    OrderProtectionModule,
    PaymentsModule,
    ThrottlerModule.forRoot([{ name: 'checkout', ttl: 60_000, limit: 10 }]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
