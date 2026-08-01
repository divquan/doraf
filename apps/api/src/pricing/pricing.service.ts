import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type AgentProductPrice } from '../generated/prisma/client';
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
      throw new BadRequestException(
        'Maximum retail price must be at least the base price',
      );
    return this.prisma.$transaction(
      async (transaction) => {
        const product = await transaction.product.findUnique({
          where: { id: input.productId },
          select: { id: true },
        });
        if (!product) throw new NotFoundException('Product not found');
        await this.closePreviousDefaultPolicy(
          transaction,
          product.id,
          input.effectiveFrom,
        );
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
        const clampedPriceCount =
          input.effectiveFrom <= new Date()
            ? await this.clampAffectedPrices(transaction, {
                productId: product.id,
                defaultBasePriceMinor: policy.basePriceMinor,
                defaultMaximumRetailPriceMinor: policy.maximumRetailPriceMinor,
                reason: input.reason,
                requestId: input.requestId,
                actor: input.actor,
              })
            : 0;
        return { policy, clampedPriceCount };
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
      throw new BadRequestException('At least one override value is required');
    if (
      input.basePriceMinor !== undefined &&
      input.maximumRetailPriceMinor !== undefined &&
      input.maximumRetailPriceMinor < input.basePriceMinor
    )
      throw new BadRequestException(
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
        const defaultPolicy = await transaction.productPricingPolicy.findFirst({
          where: {
            productId: product.id,
            effectiveFrom: { lte: input.effectiveFrom },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gt: input.effectiveFrom } },
            ],
          },
          orderBy: { effectiveFrom: 'desc' },
        });
        if (!defaultPolicy) {
          throw new BadRequestException(
            'No default pricing policy exists at the override start time',
          );
        }
        const effectiveBasePriceMinor =
          input.basePriceMinor === undefined
            ? defaultPolicy.basePriceMinor
            : BigInt(input.basePriceMinor);
        const effectiveMaximumRetailPriceMinor =
          input.maximumRetailPriceMinor === undefined
            ? defaultPolicy.maximumRetailPriceMinor
            : BigInt(input.maximumRetailPriceMinor);
        if (effectiveMaximumRetailPriceMinor < effectiveBasePriceMinor) {
          throw new BadRequestException(
            'The effective maximum retail price must be at least the effective base price',
          );
        }
        await this.closePreviousOverride(
          transaction,
          agent.id,
          product.id,
          input.effectiveFrom,
        );
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
        const clampedPriceCount =
          input.effectiveFrom <= new Date()
            ? await this.clampAffectedPrices(transaction, {
                productId: product.id,
                agentId: agent.id,
                defaultBasePriceMinor: defaultPolicy.basePriceMinor,
                defaultMaximumRetailPriceMinor:
                  defaultPolicy.maximumRetailPriceMinor,
                reason: input.reason,
                requestId: input.requestId,
                actor: input.actor,
              })
            : 0;
        return { override, clampedPriceCount };
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
      throw new BadRequestException(
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

  private async closePreviousDefaultPolicy(
    transaction: Prisma.TransactionClient,
    productId: string,
    effectiveFrom: Date,
  ): Promise<void> {
    const previous = await transaction.productPricingPolicy.findFirst({
      where: {
        productId,
        effectiveFrom: { lt: effectiveFrom },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
      },
      orderBy: { effectiveFrom: 'desc' },
      select: { id: true },
    });
    if (previous) {
      await transaction.productPricingPolicy.update({
        where: { id: previous.id },
        data: { effectiveTo: effectiveFrom },
      });
    }
  }

  private async closePreviousOverride(
    transaction: Prisma.TransactionClient,
    agentId: string,
    productId: string,
    effectiveFrom: Date,
  ): Promise<void> {
    const previous = await transaction.agentPricingOverride.findFirst({
      where: {
        agentId,
        productId,
        effectiveFrom: { lt: effectiveFrom },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
      },
      orderBy: { effectiveFrom: 'desc' },
      select: { id: true },
    });
    if (previous) {
      await transaction.agentPricingOverride.update({
        where: { id: previous.id },
        data: { effectiveTo: effectiveFrom },
      });
    }
  }

  private async clampAffectedPrices(
    transaction: Prisma.TransactionClient,
    input: {
      productId: string;
      agentId?: string;
      defaultBasePriceMinor: bigint;
      defaultMaximumRetailPriceMinor: bigint;
      reason: string;
      requestId: string;
      actor: InternalPrincipal;
    },
  ): Promise<number> {
    const prices = await transaction.agentProductPrice.findMany({
      where: {
        productId: input.productId,
        ...(input.agentId ? { agentId: input.agentId } : {}),
      },
    });
    let changed = 0;

    for (const price of prices) {
      const override = await transaction.agentPricingOverride.findFirst({
        where: {
          agentId: price.agentId,
          productId: price.productId,
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      });
      const basePriceMinor =
        override?.basePriceMinor ?? input.defaultBasePriceMinor;
      const maximumRetailPriceMinor =
        override?.maximumRetailPriceMinor ??
        input.defaultMaximumRetailPriceMinor;
      const adjusted = clampRetailPrice(
        price.retailPriceMinor,
        basePriceMinor,
        maximumRetailPriceMinor,
      );
      if (adjusted === price.retailPriceMinor) continue;

      const updated = await transaction.agentProductPrice.update({
        where: { id: price.id },
        data: { retailPriceMinor: adjusted, version: { increment: 1 } },
      });
      await this.recordClamp(transaction, price, updated, input, {
        basePriceMinor,
        maximumRetailPriceMinor,
      });
      changed += 1;
    }
    return changed;
  }

  private async recordClamp(
    transaction: Prisma.TransactionClient,
    previous: AgentProductPrice,
    updated: AgentProductPrice,
    input: {
      reason: string;
      requestId: string;
      actor: InternalPrincipal;
    },
    range: { basePriceMinor: bigint; maximumRetailPriceMinor: bigint },
  ): Promise<void> {
    await transaction.auditEvent.create({
      data: {
        actorInternalUserId: input.actor.userId,
        actorRole: input.actor.role,
        action: 'AGENT_RETAIL_PRICE_CLAMPED',
        entityType: 'AGENT_PRODUCT_PRICE',
        entityId: updated.id,
        reason: input.reason.trim(),
        authenticationStrength: input.actor.authenticationStrength,
        requestId: input.requestId,
        safeMetadata: {
          previousRetailPriceMinor: Number(previous.retailPriceMinor),
          resultingRetailPriceMinor: Number(updated.retailPriceMinor),
          effectiveBasePriceMinor: Number(range.basePriceMinor),
          effectiveMaximumRetailPriceMinor: Number(
            range.maximumRetailPriceMinor,
          ),
        },
      },
    });
    await this.outbox.enqueue(transaction, {
      eventType: 'AGENT_RETAIL_PRICE_CLAMPED',
      aggregateType: 'AGENT_PRODUCT_PRICE',
      aggregateId: updated.id,
      aggregateVersion: updated.version,
      payload: { agentId: updated.agentId, productId: updated.productId },
    });
  }
}

export function clampRetailPrice(
  current: bigint,
  minimum: bigint,
  maximum: bigint,
): bigint {
  if (maximum < minimum) {
    throw new BadRequestException('Effective pricing policy is invalid');
  }
  if (current < minimum) return minimum;
  if (current > maximum) return maximum;
  return current;
}
