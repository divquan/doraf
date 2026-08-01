import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InternalRole } from '../generated/prisma/client';
import { CurrentInternalPrincipal } from '../internal-access/current-internal-principal.decorator';
import { InternalRoles } from '../internal-access/internal-roles.decorator';
import { InternalRolesGuard } from '../internal-access/internal-roles.guard';
import { InternalSessionGuard } from '../internal-access/internal-session.guard';
import type { InternalPrincipal } from '../internal-access/internal-access.types';
import { ApproveRefundRequest } from './dto/approve-refund.request';
import { RefundsService } from './refunds.service';

@Controller('admin/refunds')
@UseGuards(InternalSessionGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMINISTRATOR)
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Get()
  listRequested() {
    return this.refunds.listRequested();
  }

  @Post(':refundId/approve')
  approve(
    @Param('refundId', new ParseUUIDPipe({ version: '4' })) refundId: string,
    @Body() request: ApproveRefundRequest,
    @CurrentInternalPrincipal() actor: InternalPrincipal,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.refunds.approve({
      refundId,
      reason: request.reason,
      actor,
      requestId:
        requestId && /^[A-Za-z0-9_-]{1,100}$/.test(requestId)
          ? requestId
          : randomUUID(),
    });
  }
}
