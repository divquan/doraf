import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  AgentStatus,
  Prisma,
  ProductStatus,
  type AgentProductPrice,
} from '../generated/prisma/client';
import type { InternalPrincipal } from '../internal-access/internal-access.types';
import { CloudTasksOutboxDispatcher } from '../operations/cloud-tasks-outbox.dispatcher';
import { IdempotencyService } from '../operations/idempotency.service';
import { OutboxService } from '../operations/outbox.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly idempotency: IdempotencyService,
    @Optional() private readonly outboxDispatcher?: CloudTasksOutboxDispatcher,
  ) {}

  async createDefaultPolicy(input: {
    productId: string;
    basePriceMinor: number;
    maximumRetailPriceMinor: number;
    effectiveFrom: Date;
    reason: string;
    requestId: string;
    actor: InternalPrincipal;
    idempotencyKey: string;
  }) {
    if (input.maximumRetailPriceMinor < input.basePriceMinor)
      throw new BadRequestException(
        'Maximum retail price must be at least the base price',
      );
    const __result = await this.prisma.$transaction(
      async (transaction) => {
        const idempotency = await this.idempotency.acquireInTransaction(
          transaction,
          idempotencyInput({
            scope: `internal:${input.actor.userId}:pricing-policy:${input.productId}`,
            key: input.idempotencyKey,
            operation: 'CREATE_PRODUCT_PRICING_POLICY',
            request: {
              productId: input.productId,
              basePriceMinor: input.basePriceMinor,
              maximumRetailPriceMinor: input.maximumRetailPriceMinor,
              effectiveFrom: input.effectiveFrom.toISOString(),
              reason: input.reason.trim(),
            },
          }),
        );
        if (!idempotency.acquired) {
          const policy =
            await transaction.productPricingPolicy.findUniqueOrThrow({
              where: { id: idempotency.record.outcomeReference! },
            });
          return {
            policy: serializePolicy(policy),
            clampedPriceCount: 0,
            replayed: true,
          };
        }
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
        if (input.effectiveFrom > new Date()) {
          await this.outbox.enqueue(transaction, {
            eventType: 'PRODUCT_PRICING_POLICY_ACTIVATION_DUE',
            aggregateType: 'PRODUCT_PRICING_POLICY',
            aggregateId: policy.id,
            aggregateVersion: 1,
            availableAt: input.effectiveFrom,
            payload: { policyId: policy.id, requestId: input.requestId },
          });
        }
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
        await this.idempotency.completeInTransaction(
          transaction,
          idempotency.record.id,
          policy.id,
        );
        return {
          policy: serializePolicy(policy),
          clampedPriceCount,
          replayed: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    void this.outboxDispatcher?.trigger().catch(() => {});
    return __result;
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
    idempotencyKey: string;
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
    const __result = await this.prisma.$transaction(
      async (transaction) => {
        const idempotency = await this.idempotency.acquireInTransaction(
          transaction,
          idempotencyInput({
            scope: `internal:${input.actor.userId}:agent-pricing-override:${input.productId}:${input.agentId}`,
            key: input.idempotencyKey,
            operation: 'CREATE_AGENT_PRICING_OVERRIDE',
            request: {
              productId: input.productId,
              agentId: input.agentId,
              basePriceMinor: input.basePriceMinor ?? null,
              maximumRetailPriceMinor: input.maximumRetailPriceMinor ?? null,
              effectiveFrom: input.effectiveFrom.toISOString(),
              reason: input.reason.trim(),
            },
          }),
        );
        if (!idempotency.acquired) {
          const override =
            await transaction.agentPricingOverride.findUniqueOrThrow({
              where: { id: idempotency.record.outcomeReference! },
            });
          return {
            override: serializeOverride(override),
            clampedPriceCount: 0,
            replayed: true,
          };
        }
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
        if (input.effectiveFrom > new Date()) {
          await this.outbox.enqueue(transaction, {
            eventType: 'AGENT_PRICING_OVERRIDE_ACTIVATION_DUE',
            aggregateType: 'AGENT_PRICING_OVERRIDE',
            aggregateId: override.id,
            aggregateVersion: 1,
            availableAt: input.effectiveFrom,
            payload: { overrideId: override.id, requestId: input.requestId },
          });
        }
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
        await this.idempotency.completeInTransaction(
          transaction,
          idempotency.record.id,
          override.id,
        );
        return {
          override: serializeOverride(override),
          clampedPriceCount,
          replayed: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    void this.outboxDispatcher?.trigger().catch(() => {});
    return __result;
  }

  async setRetailPrice(input: {
    agentId: string;
    productId: string;
    retailPriceMinor: number;
    idempotencyKey: string;
  }) {
    const __result = await this.prisma.$transaction(
      async (transaction) => {
        const idempotency = await this.idempotency.acquireInTransaction(
          transaction,
          idempotencyInput({
            scope: `agent:${input.agentId}:retail-price:${input.productId}`,
            key: input.idempotencyKey,
            operation: 'SET_AGENT_RETAIL_PRICE',
            request: input,
          }),
        );
        if (!idempotency.acquired) {
          const replay = await transaction.agentProductPrice.findUniqueOrThrow({
            where: { id: idempotency.record.outcomeReference! },
          });
          return { price: serializePrice(replay), replayed: true };
        }
        const agent = await transaction.agent.findUnique({
          where: { id: input.agentId },
          select: { status: true },
        });
        if (!agent) throw new NotFoundException('Agent not found');
        if (agent.status !== AgentStatus.ACTIVE)
          throw new ForbiddenException(
            'Suspended agents cannot change retail prices',
          );
        const effective = await this.effectiveForAgentInTransaction(
          transaction,
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
        await this.idempotency.completeInTransaction(
          transaction,
          idempotency.record.id,
          price.id,
        );
        return { price: serializePrice(price), replayed: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    void this.outboxDispatcher?.trigger().catch(() => {});
    return __result;
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

  async listForAgent(agentId: string) {
    const products = await this.prisma.product.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        agentProductPrices: { where: { agentId }, take: 1 },
      },
    });
    const rows = await Promise.all(
      products.map(async (product) => {
        try {
          const effective = await this.effectiveForAgent(agentId, product.id);
          const current = product.agentProductPrices[0];
          return {
            product: {
              id: product.id,
              code: product.code,
              name: product.name,
              scopeDisclosure: product.scopeDisclosure,
              status: product.status,
            },
            pricing: {
              currency: effective.currency.trim(),
              basePriceMinor: Number(effective.basePriceMinor),
              maximumRetailPriceMinor: Number(
                effective.maximumRetailPriceMinor,
              ),
              retailPriceMinor: current
                ? Number(current.retailPriceMinor)
                : null,
              profitMinor: current
                ? Number(current.retailPriceMinor - effective.basePriceMinor)
                : null,
              source: effective.overrideId ? 'AGENT_OVERRIDE' : 'DEFAULT',
            },
          };
        } catch (error) {
          if (!(error instanceof NotFoundException)) throw error;
          return null;
        }
      }),
    );
    return rows.filter((row) => row !== null);
  }

  async listForAdministration() {
    const now = new Date();
    const [products, agents] = await Promise.all([
      this.prisma.product.findMany({
        orderBy: { displayOrder: 'asc' },
        include: {
          pricingPolicies: {
            where: {
              effectiveFrom: { lte: now },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
            },
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.agent.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          phoneMask: true,
          status: true,
          webSalesId: true,
          _count: {
            select: {
              pricingOverrides: {
                where: {
                  effectiveFrom: { lte: now },
                  OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
                },
              },
            },
          },
        },
      }),
    ]);
    return {
      products: products.map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        status: product.status,
        policy: product.pricingPolicies[0]
          ? serializePolicy(product.pricingPolicies[0])
          : null,
      })),
      agents: agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        phoneMask: agent.phoneMask,
        status: agent.status,
        webSalesId: agent.webSalesId,
        overrideCount: agent._count.pricingOverrides,
      })),
    };
  }

  async listOverridesForAgent(agentId: string) {
    const now = new Date();
    const [overrides, products] = await Promise.all([
      this.prisma.agentPricingOverride.findMany({
        where: {
          agentId,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
        orderBy: { effectiveFrom: 'desc' },
        include: {
          product: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.product.findMany({
        orderBy: { displayOrder: 'asc' },
        include: {
          pricingPolicies: {
            where: {
              effectiveFrom: { lte: now },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
            },
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
          },
        },
      }),
    ]);
    return {
      overrides: overrides.map((override) => ({
        id: override.id,
        productId: override.productId,
        productCode: override.product.code,
        productName: override.product.name,
        basePriceMinor:
          override.basePriceMinor === null
            ? null
            : Number(override.basePriceMinor),
        maximumRetailPriceMinor:
          override.maximumRetailPriceMinor === null
            ? null
            : Number(override.maximumRetailPriceMinor),
        effectiveFrom: override.effectiveFrom.toISOString(),
        effectiveTo: override.effectiveTo?.toISOString() ?? null,
        reason: override.reason,
        createdAt: override.createdAt.toISOString(),
      })),
      products: products.map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        status: product.status,
        policy: product.pricingPolicies[0]
          ? serializePolicy(product.pricingPolicies[0])
          : null,
      })),
    };
  }

  async closeOverride(input: {
    agentId: string;
    overrideId: string;
    reason: string;
    requestId: string;
    actor: InternalPrincipal;
  }) {
    const __result = await this.prisma.$transaction(
      async (transaction) => {
        const override = await transaction.agentPricingOverride.findUnique({
          where: { id: input.overrideId },
        });
        if (!override || override.agentId !== input.agentId) {
          throw new NotFoundException('Pricing override not found');
        }
        const now = new Date();
        if (
          override.effectiveFrom > now ||
          (override.effectiveTo !== null && override.effectiveTo <= now)
        ) {
          throw new ConflictException('Pricing override is already inactive');
        }
        const updated = await transaction.agentPricingOverride.update({
          where: { id: override.id },
          data: { effectiveTo: now },
        });
        await transaction.auditEvent.create({
          data: {
            actorInternalUserId: input.actor.userId,
            actorRole: input.actor.role,
            action: 'AGENT_PRICING_OVERRIDE_CLOSED',
            entityType: 'AGENT_PRICING_OVERRIDE',
            entityId: override.id,
            reason: input.reason.trim(),
            authenticationStrength: input.actor.authenticationStrength,
            requestId: input.requestId,
            safeMetadata: {
              agentId: override.agentId,
              productId: override.productId,
            },
          },
        });
        await this.outbox.enqueue(transaction, {
          eventType: 'AGENT_PRICING_OVERRIDE_CLOSED',
          aggregateType: 'AGENT_PRICING_OVERRIDE',
          aggregateId: override.id,
          aggregateVersion: 1,
          payload: { agentId: override.agentId, productId: override.productId },
        });
        const defaultPolicy = await transaction.productPricingPolicy.findFirst({
          where: {
            productId: override.productId,
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
          orderBy: { effectiveFrom: 'desc' },
        });
        const clampedPriceCount = defaultPolicy
          ? await this.clampAffectedPrices(transaction, {
              productId: override.productId,
              agentId: override.agentId,
              defaultBasePriceMinor: defaultPolicy.basePriceMinor,
              defaultMaximumRetailPriceMinor:
                defaultPolicy.maximumRetailPriceMinor,
              reason: input.reason,
              requestId: input.requestId,
              actor: input.actor,
            })
          : 0;
        return {
          override: serializeOverride(updated),
          clampedPriceCount,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    void this.outboxDispatcher?.trigger().catch(() => {});
    return __result;
  }

  async changeProductStatus(input: {
    productId: string;
    status: ProductStatus;
    reason: string;
    requestId: string;
    actor: InternalPrincipal;
  }) {
    const __result = await this.prisma.$transaction(
      async (transaction) => {
        const product = await transaction.product.findUnique({
          where: { id: input.productId },
          select: { id: true, code: true, name: true, status: true },
        });
        if (!product) throw new NotFoundException('Product not found');
        if (product.status === input.status) {
          throw new ConflictException(
            input.status === ProductStatus.ACTIVE
              ? 'Product is already available'
              : 'Product is already unavailable',
          );
        }
        const updated = await transaction.product.update({
          where: { id: product.id },
          data: { status: input.status },
          select: { id: true, code: true, name: true, status: true },
        });
        await transaction.auditEvent.create({
          data: {
            actorInternalUserId: input.actor.userId,
            actorRole: input.actor.role,
            action:
              input.status === ProductStatus.ACTIVE
                ? 'PRODUCT_MADE_AVAILABLE'
                : 'PRODUCT_MADE_UNAVAILABLE',
            entityType: 'PRODUCT',
            entityId: product.id,
            reason: input.reason.trim(),
            authenticationStrength: input.actor.authenticationStrength,
            requestId: input.requestId,
            safeMetadata: {
              previousStatus: product.status,
              resultingStatus: updated.status,
            },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    void this.outboxDispatcher?.trigger().catch(() => {});
    return __result;
  }

  async applyScheduledDefaultPolicy(policyId: string): Promise<number> {
    const __result = await this.prisma.$transaction(
      async (transaction) => {
        const policy = await transaction.productPricingPolicy.findUnique({
          where: { id: policyId },
        });
        if (!policy) throw new NotFoundException('Pricing policy not found');
        const now = new Date();
        if (
          policy.effectiveFrom > now ||
          (policy.effectiveTo !== null && policy.effectiveTo <= now)
        )
          return 0;
        const currentPolicy = await transaction.productPricingPolicy.findFirst({
          where: {
            productId: policy.productId,
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
          orderBy: { effectiveFrom: 'desc' },
          select: { id: true },
        });
        if (currentPolicy?.id !== policy.id) return 0;
        const audit = await transaction.auditEvent.findFirstOrThrow({
          where: {
            entityType: 'PRODUCT_PRICING_POLICY',
            entityId: policy.id,
            action: 'PRODUCT_PRICING_POLICY_CREATED',
          },
          orderBy: { createdAt: 'asc' },
        });
        return this.clampAffectedPrices(transaction, {
          productId: policy.productId,
          defaultBasePriceMinor: policy.basePriceMinor,
          defaultMaximumRetailPriceMinor: policy.maximumRetailPriceMinor,
          reason: `Scheduled activation: ${policy.reason}`,
          requestId: audit.requestId,
          actor: auditActor(audit),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    void this.outboxDispatcher?.trigger().catch(() => {});
    return __result;
  }

  async applyScheduledOverride(overrideId: string): Promise<number> {
    const __result = await this.prisma.$transaction(
      async (transaction) => {
        const override = await transaction.agentPricingOverride.findUnique({
          where: { id: overrideId },
        });
        if (!override)
          throw new NotFoundException('Pricing override not found');
        const now = new Date();
        if (
          override.effectiveFrom > now ||
          (override.effectiveTo !== null && override.effectiveTo <= now)
        )
          return 0;
        const currentOverride =
          await transaction.agentPricingOverride.findFirst({
            where: {
              agentId: override.agentId,
              productId: override.productId,
              effectiveFrom: { lte: now },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
            },
            orderBy: { effectiveFrom: 'desc' },
            select: { id: true },
          });
        if (currentOverride?.id !== override.id) return 0;
        const [policy, audit] = await Promise.all([
          transaction.productPricingPolicy.findFirst({
            where: {
              productId: override.productId,
              effectiveFrom: { lte: now },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
            },
            orderBy: { effectiveFrom: 'desc' },
          }),
          transaction.auditEvent.findFirstOrThrow({
            where: {
              entityType: 'AGENT_PRICING_OVERRIDE',
              entityId: override.id,
              action: 'AGENT_PRICING_OVERRIDE_CREATED',
            },
            orderBy: { createdAt: 'asc' },
          }),
        ]);
        if (!policy)
          throw new NotFoundException(
            'Active default pricing policy not found',
          );
        return this.clampAffectedPrices(transaction, {
          productId: override.productId,
          agentId: override.agentId,
          defaultBasePriceMinor: policy.basePriceMinor,
          defaultMaximumRetailPriceMinor: policy.maximumRetailPriceMinor,
          reason: `Scheduled activation: ${override.reason}`,
          requestId: audit.requestId,
          actor: auditActor(audit),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    void this.outboxDispatcher?.trigger().catch(() => {});
    return __result;
  }

  private async effectiveForAgentInTransaction(
    transaction: Prisma.TransactionClient,
    agentId: string,
    productId: string,
    now = new Date(),
  ) {
    const [policy, override] = await Promise.all([
      transaction.productPricingPolicy.findFirst({
        where: {
          productId,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      }),
      transaction.agentPricingOverride.findFirst({
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
    if (maximumRetailPriceMinor < basePriceMinor)
      throw new BadRequestException('Effective pricing policy is invalid');
    return { basePriceMinor, maximumRetailPriceMinor };
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

function idempotencyInput(input: {
  scope: string;
  key: string;
  operation: string;
  request: unknown;
}) {
  return {
    scope: input.scope,
    key: input.key,
    operation: input.operation,
    requestFingerprint: createHash('sha256')
      .update(JSON.stringify(input.request))
      .digest(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}

function serializePolicy(policy: {
  id: string;
  productId: string;
  basePriceMinor: bigint;
  maximumRetailPriceMinor: bigint;
  currency: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  reason: string;
}) {
  return {
    ...policy,
    basePriceMinor: Number(policy.basePriceMinor),
    maximumRetailPriceMinor: Number(policy.maximumRetailPriceMinor),
    currency: policy.currency.trim(),
  };
}

function serializeOverride(override: {
  id: string;
  agentId: string;
  productId: string;
  basePriceMinor: bigint | null;
  maximumRetailPriceMinor: bigint | null;
  currency: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  reason: string;
}) {
  return {
    ...override,
    basePriceMinor:
      override.basePriceMinor === null ? null : Number(override.basePriceMinor),
    maximumRetailPriceMinor:
      override.maximumRetailPriceMinor === null
        ? null
        : Number(override.maximumRetailPriceMinor),
    currency: override.currency.trim(),
  };
}

function serializePrice(price: AgentProductPrice) {
  return { ...price, retailPriceMinor: Number(price.retailPriceMinor) };
}

function auditActor(audit: {
  actorInternalUserId: string;
  actorRole: InternalPrincipal['role'];
  authenticationStrength: string;
}): InternalPrincipal {
  return {
    userId: audit.actorInternalUserId,
    sessionId: 'scheduled-pricing-activation',
    displayName: 'Scheduled pricing activation',
    role: audit.actorRole,
    authenticationStrength:
      audit.authenticationStrength as InternalPrincipal['authenticationStrength'],
    authenticatedAt: new Date(),
    stepUpAt: null,
  };
}
