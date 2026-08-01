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
          aggregateType: 'PRODUCT_PRICING_POLICY',
          aggregateId: policy.id,
          aggregateVersion: 1,
          payload: { policyId: policy.id },
        });
        return policy;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async createOverride(input: {
    productId: string;
    agentId: string;
    basePriceMinor?: number;
    maximumRetailPriceMinor?: number;
    effectiveFrom: Date;
    reason: string;
    requestId: string;
    actor: InternalPrincipal;
  }) {
    if (
      input.basePriceMinor === undefined &&
      input.maximumRetailPriceMinor === undefined
    )
      throw new NotFoundException('At least one override value is required');
    if (
      input.basePriceMinor !== undefined &&
      input.maximumRetailPriceMinor !== undefined &&
      input.maximumRetailPriceMinor < input.basePriceMinor
    )
      throw new NotFoundException(
        'Maximum retail price must be at least the base price',
      );
    return this.prisma.$transaction(
      async (transaction) => {
        const [agent, product] = await Promise.all([
          transaction.agent.findUnique({
            where: { id: input.agentId },
            select: { id: true },
          }),
          transaction.product.findUnique({
            where: { id: input.productId },
            select: { id: true },
          }),
        ]);
        if (!agent || !product)
          throw new NotFoundException('Agent or product not found');
        const override = await transaction.agentPricingOverride.create({
          data: {
            agentId: agent.id,
            productId: product.id,
            basePriceMinor:
              input.basePriceMinor === undefined
                ? undefined
                : BigInt(input.basePriceMinor),
            maximumRetailPriceMinor:
              input.maximumRetailPriceMinor === undefined
                ? undefined
                : BigInt(input.maximumRetailPriceMinor),
            effectiveFrom: input.effectiveFrom,
            reason: input.reason.trim(),
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorInternalUserId: input.actor.userId,
            actorRole: input.actor.role,
            action: 'AGENT_PRICING_OVERRIDE_CREATED',
            entityType: 'AGENT_PRICING_OVERRIDE',
            entityId: override.id,
            reason: input.reason.trim(),
            authenticationStrength: input.actor.authenticationStrength,
            requestId: input.requestId,
            safeMetadata: { agentId: agent.id, productId: product.id },
          },
        });
        await this.outbox.enqueue(transaction, {
          eventType: 'AGENT_PRICING_OVERRIDE_CREATED',
          aggregateType: 'AGENT_PRICING_OVERRIDE',
          aggregateId: override.id,
          aggregateVersion: 1,
          payload: { agentId: agent.id, productId: product.id },
        });
        return override;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async setRetailPrice(input: {
    agentId: string;
    productId: string;
    retailPriceMinor: number;
  }) {
    const effective = await this.effectiveForAgent(
      input.agentId,
      input.productId,
    );
    const retailPriceMinor = BigInt(input.retailPriceMinor);
    if (
      retailPriceMinor < effective.basePriceMinor ||
      retailPriceMinor > effective.maximumRetailPriceMinor
    ) {
      throw new NotFoundException(
        'Retail price is outside the permitted range',
      );
    }
    return this.prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.agentProductPrice.findUnique({
          where: {
            agentId_productId: {
              agentId: input.agentId,
              productId: input.productId,
            },
          },
          select: { id: true, version: true },
        });
        const price = existing
          ? await transaction.agentProductPrice.update({
              where: { id: existing.id },
              data: { retailPriceMinor, version: { increment: 1 } },
            })
          : await transaction.agentProductPrice.create({
              data: {
                agentId: input.agentId,
                productId: input.productId,
                retailPriceMinor,
              },
            });
        await this.outbox.enqueue(transaction, {
          eventType: 'AGENT_RETAIL_PRICE_SET',
          aggregateType: 'AGENT_PRODUCT_PRICE',
          aggregateId: price.id,
          aggregateVersion: price.version,
          payload: { agentId: input.agentId, productId: input.productId },
        });
        return price;
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
