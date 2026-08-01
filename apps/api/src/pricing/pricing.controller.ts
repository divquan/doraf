import {
  Body,
  Controller,
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
import { PricingService } from './pricing.service';

@Controller('admin/products')
@UseGuards(InternalSessionGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMINISTRATOR)
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Post(':productId/pricing-policies')
  create(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() request: CreateProductPricingPolicyRequest,
    @CurrentInternalPrincipal() actor: InternalPrincipal,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.pricing.createDefaultPolicy({
      productId,
      ...request,
      effectiveFrom: new Date(request.effectiveFrom),
      actor,
      requestId: requestId ?? randomUUID(),
    });
  }

  @Post(':productId/agent-overrides/:agentId')
  createOverride(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Param('agentId', new ParseUUIDPipe({ version: '4' })) agentId: string,
    @Body() request: CreateAgentPricingOverrideRequest,
    @CurrentInternalPrincipal() actor: InternalPrincipal,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.pricing.createOverride({
      productId,
      agentId,
      ...request,
      effectiveFrom: new Date(request.effectiveFrom),
      actor,
      requestId: requestId ?? randomUUID(),
    });
  }
}
