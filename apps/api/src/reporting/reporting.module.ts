import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { InternalAccessModule } from '../internal-access/internal-access.module';
import { ReportingAdminController } from './reporting-admin.controller';
import { ReportingService } from './reporting.service';

@Module({
  imports: [DatabaseModule, InternalAccessModule],
  controllers: [ReportingAdminController],
  providers: [ReportingService],
  exports: [ReportingService],
})
export class ReportingModule {}
