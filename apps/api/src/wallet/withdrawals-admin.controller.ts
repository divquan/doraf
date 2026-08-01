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
import { WithdrawalDecisionRequest } from './dto/withdrawal-decision.request';
import { FinalizeWithdrawalTransferRequest } from './dto/finalize-withdrawal-transfer.request';
import { WithdrawalsService } from './withdrawals.service';

@Controller('admin/withdrawals')
@UseGuards(InternalSessionGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMINISTRATOR)
export class WithdrawalsAdminController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Get()
  list() {
    return this.withdrawals.listForAdmin();
  }

  @Post(':withdrawalId/approve')
  approve(
    @Param('withdrawalId', new ParseUUIDPipe({ version: '4' }))
    withdrawalId: string,
    @Body() request: WithdrawalDecisionRequest,
    @CurrentInternalPrincipal() actor: InternalPrincipal,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.withdrawals.decide({
      withdrawalId,
      approve: true,
      reason: request.reason,
      actor,
      requestId: safeRequestId(requestId),
    });
  }

  @Post(':withdrawalId/reject')
  reject(
    @Param('withdrawalId', new ParseUUIDPipe({ version: '4' }))
    withdrawalId: string,
    @Body() request: WithdrawalDecisionRequest,
    @CurrentInternalPrincipal() actor: InternalPrincipal,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.withdrawals.decide({
      withdrawalId,
      approve: false,
      reason: request.reason,
      actor,
      requestId: safeRequestId(requestId),
    });
  }

  @Post(':withdrawalId/verify-transfer')
  verifyTransfer(
    @Param('withdrawalId', new ParseUUIDPipe({ version: '4' }))
    withdrawalId: string,
  ) {
    return this.withdrawals.verifyTransfer(withdrawalId);
  }

  @Post(':withdrawalId/finalize-transfer')
  finalizeTransfer(
    @Param('withdrawalId', new ParseUUIDPipe({ version: '4' }))
    withdrawalId: string,
    @Body() request: FinalizeWithdrawalTransferRequest,
  ) {
    return this.withdrawals.finalizeMerchantOtp(withdrawalId, request.otp);
  }
}

function safeRequestId(value?: string) {
  return value && /^[A-Za-z0-9_-]{1,100}$/.test(value) ? value : randomUUID();
}
