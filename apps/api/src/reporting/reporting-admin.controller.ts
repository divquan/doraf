import { Controller, Get, UseGuards } from '@nestjs/common';
import { InternalRole } from '../generated/prisma/client';
import { InternalRoles } from '../internal-access/internal-roles.decorator';
import { InternalRolesGuard } from '../internal-access/internal-roles.guard';
import { InternalSessionGuard } from '../internal-access/internal-session.guard';
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
}
