import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { InternalRole } from '../generated/prisma/client';
import { InternalRoles } from '../internal-access/internal-roles.decorator';
import { InternalRolesGuard } from '../internal-access/internal-roles.guard';
import { InternalSessionGuard } from '../internal-access/internal-session.guard';
import { NoStoreInterceptor } from '../internal-access/no-store.interceptor';
import { InventoryReadService } from './inventory-read.service';

@Controller('admin/inventory')
@UseGuards(InternalSessionGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMINISTRATOR, InternalRole.SUPPORT)
@UseInterceptors(NoStoreInterceptor)
export class InventoryReadController {
  constructor(private readonly inventory: InventoryReadService) {}

  @Get()
  overview() {
    return this.inventory.getOverview();
  }

  @Get('batches/:batchId')
  batch(
    @Param('batchId', new ParseUUIDPipe({ version: '4' })) batchId: string,
  ) {
    return this.inventory.getBatch(batchId);
  }
}
