import {
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  InternalRole,
  OrderFulfillmentState,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { InternalRoles } from '../internal-access/internal-roles.decorator';
import { InternalRolesGuard } from '../internal-access/internal-roles.guard';
import { InternalSessionGuard } from '../internal-access/internal-session.guard';
import { ApproveRefundRequest } from '../refunds/dto/approve-refund.request';

@Controller('admin/orders/fulfillment-exceptions')
@UseGuards(InternalSessionGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMINISTRATOR)
export class OrderExceptionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.order.findMany({
      where: { fulfillmentState: OrderFulfillmentState.EXCEPTION },
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true,
        publicReference: true,
        quantity: true,
        currency: true,
        retailTotalMinor: true,
        createdAt: true,
        updatedAt: true,
        product: { select: { code: true, name: true } },
        paymentAttempts: {
          where: { classification: 'ACCEPTED' },
          select: { providerReference: true, providerTransactionId: true },
        },
      },
    });
  }

  @Post(':orderId/refund-request')
  async requestRefund(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() input: ApproveRefundRequest,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { paymentAttempts: { where: { classification: 'ACCEPTED' } } },
    });
    if (!order || order.fulfillmentState !== OrderFulfillmentState.EXCEPTION) {
      throw new ConflictException(
        'Order is not awaiting fulfillment resolution',
      );
    }
    const attempt = order.paymentAttempts[0];
    if (!attempt) throw new ConflictException('Accepted payment is missing');
    return this.prisma.refund.create({
      data: {
        orderId,
        paymentAttemptId: attempt.id,
        amountMinor: attempt.expectedAmountMinor,
        currency: attempt.currency,
        reason: 'UNFULFILLABLE_PAID_ORDER',
        safeMetadata: { resolutionReason: input.reason },
      },
    });
  }
}
