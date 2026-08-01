import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { InternalPrincipal } from '../internal-access/internal-access.types';
import { OutboxService } from '../operations/outbox.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async createDefaultPolicy(input: {
    productId: string;
    basePriceMinor: number;
    maximumRetailPriceMinor: number;
    effectiveFrom: Date;
    reason: string;
    requestId: string;
    actor: InternalPrincipal;
  }) {
    if (input.maximumRetailPriceMinor < input.basePriceMinor)
      throw new NotFoundException(
        'Maximum retail price must be at least the base price',
      );
    return this.prisma.$transaction(
      async (transaction) => {
        const product = await transaction.product.findUnique({
          where: { id: input.productId },
          select: { id: true },
        });
        if (!product) throw new NotFoundException('Product not found');
        const policy = await transaction.productPricingPolicy.create({
          data: {
            productId: product.id,
            basePriceMinor: BigInt(input.basePriceMinor),
            maximumRetailPriceMinor: BigInt(input.maximumRetailPriceMinor),
            effectiveFrom: input.effectiveFrom,
            reason: input.reason.trim(),
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorInternalUserId: input.actor.userId,
            actorRole: input.actor.role,
            action: 'PRODUCT_PRICING_POLICY_CREATED',
            entityType: 'PRODUCT_PRICING_POLICY',
            entityId: policy.id,
            reason: input.reason.trim(),
            authenticationStrength: input.actor.authenticationStrength,
            requestId: input.requestId,
            safeMetadata: {
              productId: product.id,
              basePriceMinor: input.basePriceMinor,
              maximumRetailPriceMinor: input.maximumRetailPriceMinor,
            },
          },
        });
        await this.outbox.enqueue(transaction, {
          eventType: 'PRODUCT_PRICING_POLICY_CREATED',
          aggregateType: 'PRODUCT',
          aggregateId: product.id,
          aggregateVersion: 1,
          payload: { policyId: policy.id },
        });
        return policy;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async effectiveForAgent(
    agentId: string,
    productId: string,
    now = new Date(),
  ) {
    const [policy, override] = await Promise.all([
      this.prisma.productPricingPolicy.findFirst({
        where: {
          productId,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      }),
      this.prisma.agentPricingOverride.findFirst({
        where: {
          agentId,
          productId,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      }),
    ]);
    if (!policy)
      throw new NotFoundException(
        'No active pricing policy exists for this product',
      );
    const basePriceMinor = override?.basePriceMinor ?? policy.basePriceMinor;
    const maximumRetailPriceMinor =
      override?.maximumRetailPriceMinor ?? policy.maximumRetailPriceMinor;
    if (maximumRetailPriceMinor < basePriceMinor) {
      throw new NotFoundException('Effective pricing policy is invalid');
    }
    return {
      currency: policy.currency,
      basePriceMinor,
      maximumRetailPriceMinor,
      policyId: policy.id,
      overrideId: override?.id ?? null,
    };
  }
}
