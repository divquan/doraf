import {
  BadRequestException,
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
import { CreateProductPricingPolicyRequest } from './dto/create-product-pricing-policy.request';
import { CreateAgentPricingOverrideRequest } from './dto/create-agent-pricing-override.request';
import { ChangeProductStatusRequest } from './dto/change-product-status.request';
import { PricingService } from './pricing.service';

@Controller('admin/products')
@UseGuards(InternalSessionGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMINISTRATOR)
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('pricing')
  @InternalRoles(InternalRole.ADMINISTRATOR, InternalRole.SUPPORT)
  async list(@CurrentInternalPrincipal() actor: InternalPrincipal) {
    return {
      ...(await this.pricing.listForAdministration()),
      viewerRole: actor.role,
    };
  }

  @Post(':productId/pricing-policies')
  create(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() request: CreateProductPricingPolicyRequest,
    @CurrentInternalPrincipal() actor: InternalPrincipal,
    @Headers('x-request-id') requestId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.pricing.createDefaultPolicy({
      productId,
      ...request,
      effectiveFrom: new Date(request.effectiveFrom),
      actor,
      requestId: requestId ?? randomUUID(),
      idempotencyKey: requiredIdempotencyKey(idempotencyKey),
    });
  }

  @Post(':productId/agent-overrides/:agentId')
  createOverride(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Param('agentId', new ParseUUIDPipe({ version: '4' })) agentId: string,
    @Body() request: CreateAgentPricingOverrideRequest,
    @CurrentInternalPrincipal() actor: InternalPrincipal,
    @Headers('x-request-id') requestId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.pricing.createOverride({
      productId,
      agentId,
      ...request,
      effectiveFrom: new Date(request.effectiveFrom),
      actor,
      requestId: requestId ?? randomUUID(),
      idempotencyKey: requiredIdempotencyKey(idempotencyKey),
    });
  }

  @Post(':productId/status')
  changeStatus(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() request: ChangeProductStatusRequest,
    @CurrentInternalPrincipal() actor: InternalPrincipal,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.pricing.changeProductStatus({
      productId,
      status: request.status,
      reason: request.reason,
      actor,
      requestId: requestId ?? randomUUID(),
    });
  }
}

function requiredIdempotencyKey(value?: string): string {
  if (!value || !/^[A-Za-z0-9._:-]{8,200}$/.test(value)) {
    throw new BadRequestException(
      'Idempotency-Key must contain 8 to 200 safe characters',
    );
  }
  return value;
}
