import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { InternalRole } from '../generated/prisma/client';
import { InternalRoles } from '../internal-access/internal-roles.decorator';
import { InternalRolesGuard } from '../internal-access/internal-roles.guard';
import { InternalSessionGuard } from '../internal-access/internal-session.guard';
import { NoStoreInterceptor } from '../internal-access/no-store.interceptor';
import { OrdersService } from './orders.service';

@Controller('admin/orders')
@UseGuards(InternalSessionGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMINISTRATOR, InternalRole.SUPPORT)
@UseInterceptors(NoStoreInterceptor)
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  listOrders(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page && /^\d+$/.test(page) ? parseInt(page, 10) : 1;
    const limitNum = limit && /^\d+$/.test(limit) ? parseInt(limit, 10) : 10;
    return this.orders.listOrdersForAdmin(pageNum, limitNum);
  }
}
