import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { InternalAccessModule } from '../internal-access/internal-access.module';
import { InvariantAuditorService } from './invariant-auditor.service';
import { ReportingAdminController } from './reporting-admin.controller';
import { ReportingService } from './reporting.service';

@Module({
  imports: [DatabaseModule, InternalAccessModule],
  controllers: [ReportingAdminController],
  providers: [ReportingService, InvariantAuditorService],
  exports: [ReportingService, InvariantAuditorService],
})
export class ReportingModule {}
