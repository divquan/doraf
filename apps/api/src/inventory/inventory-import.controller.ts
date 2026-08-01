import {
  Body,
  Controller,
  Headers,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InternalRole } from '../generated/prisma/client';
import { CurrentInternalPrincipal } from '../internal-access/current-internal-principal.decorator';
import { InternalRoles } from '../internal-access/internal-roles.decorator';
import { InternalRolesGuard } from '../internal-access/internal-roles.guard';
import { InternalSessionGuard } from '../internal-access/internal-session.guard';
import type { InternalPrincipal } from '../internal-access/internal-access.types';
import { CommitInventoryImportRequest } from './dto/commit-inventory-import.request';
import { PreviewInventoryImportRequest } from './dto/preview-inventory-import.request';
import { InventoryImportExceptionFilter } from './inventory-import-exception.filter';
import { InventoryImportService } from './inventory-import.service';
import type {
  CommittedInventoryBatch,
  InventoryPreview,
} from './inventory.types';

@Controller('admin/inventory/imports')
@UseGuards(InternalSessionGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMINISTRATOR)
@UseFilters(InventoryImportExceptionFilter)
export class InventoryImportController {
  constructor(private readonly imports: InventoryImportService) {}

  @Post('preview')
  preview(
    @Body() request: PreviewInventoryImportRequest,
  ): Promise<InventoryPreview> {
    return this.imports.previewEntries(request.productId, request.entries);
  }

  @Post()
  commit(
    @Body() request: CommitInventoryImportRequest,
    @CurrentInternalPrincipal() principal: InternalPrincipal,
    @Headers('x-request-id') requestId?: string,
  ): Promise<CommittedInventoryBatch> {
    return this.imports.importEntries({
      productId: request.productId,
      vendorName: request.vendorName,
      vendorReference: request.vendorReference,
      acquisitionDate: new Date(request.acquisitionDate),
      unitAcquisitionCostMinor: BigInt(request.unitAcquisitionCostMinor),
      uploadedByActorId: principal.userId,
      actorRole: 'ADMINISTRATOR',
      authenticationStrength: principal.authenticationStrength,
      reason: request.reason,
      requestId: safeRequestId(requestId),
      entries: request.entries,
    });
  }
}

function safeRequestId(value: string | undefined): string {
  return value && /^[A-Za-z0-9_-]{1,100}$/.test(value) ? value : randomUUID();
}
