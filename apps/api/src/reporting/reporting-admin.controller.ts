import { Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InternalRole } from '../generated/prisma/client';
import { InternalRoles } from '../internal-access/internal-roles.decorator';
import { InternalRolesGuard } from '../internal-access/internal-roles.guard';
import { InternalSessionGuard } from '../internal-access/internal-session.guard';
import { CurrentInternalPrincipal } from '../internal-access/current-internal-principal.decorator';
import type { InternalPrincipal } from '../internal-access/internal-access.types';
import { ReportingService } from './reporting.service';

@Controller('admin/reporting')
@UseGuards(InternalSessionGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMINISTRATOR, InternalRole.SUPPORT)
export class ReportingAdminController {
  constructor(private readonly reporting: ReportingService) {}

  @Get('overview')
  getOverview() {
    return this.reporting.getAdminOverview();
  }

  @Get('invariants')
  getInvariants() {
    return this.reporting.getInvariantsReport();
  }

  @Post('requeue-outbox')
  requeueOutbox(
    @CurrentInternalPrincipal() actor: InternalPrincipal,
    @Headers('x-request-id') requestId?: string,
  ) {
    const safeRequestId =
      requestId && /^[A-Za-z0-9_-]{1,100}$/.test(requestId)
        ? requestId
        : randomUUID();
    return this.reporting.requeueStuckOutbox(actor, safeRequestId);
  }
}
