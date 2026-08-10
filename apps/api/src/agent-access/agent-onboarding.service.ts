import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AgentOnboardingAction } from './dto/update-agent-onboarding.request';
import { PricingService } from '../pricing/pricing.service';
import { SalesChannelService } from './sales-channel.service';

@Injectable()
export class AgentOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly salesChannels: SalesChannelService,
  ) {}

  async get(agentId: string) {
    const [agent, onboarding, prices, storefront] = await Promise.all([
      this.prisma.agent.findUnique({
        where: { id: agentId },
        select: { id: true },
      }),
      this.prisma.agentOnboarding.findUnique({ where: { agentId } }),
      this.pricing.listForAgent(agentId),
      this.salesChannels.getForAgent(agentId),
    ]);

    if (!agent) throw new NotFoundException('Agent not found');

    return this.toResponse(onboarding, prices, storefront);
  }

  async record(agentId: string, action: AgentOnboardingAction) {
    const now = new Date();
    const existing = await this.prisma.agentOnboarding.upsert({
      where: { agentId },
      create: { agentId },
      update: {},
    });

    if (
      action === 'COMPLETE' ||
      action === 'PRICES_CONFIGURED' ||
      action === 'STOREFRONT_CONFIGURED'
    ) {
      const [prices, current, storefront] = await Promise.all([
        this.pricing.listForAgent(agentId),
        Promise.resolve(existing),
        this.salesChannels.getForAgent(agentId),
      ]);
      const pricesConfigured =
        prices.length > 0 &&
        prices.every((row) => row.pricing.retailPriceMinor !== null);
      const storefrontConfigured = Boolean(
        storefront.storeName?.trim() && storefront.slug?.trim(),
      );
      if (
        (action === 'STOREFRONT_CONFIGURED' && !storefrontConfigured) ||
        ((action === 'COMPLETE' || action === 'PRICES_CONFIGURED') &&
          !pricesConfigured) ||
        (action === 'COMPLETE' &&
          (!storefrontConfigured ||
            !current.productsReviewedAt ||
            !current.storefrontSharedAt))
      ) {
        throw new BadRequestException(
          action === 'STOREFRONT_CONFIGURED'
            ? 'Set your store name and store link before continuing'
            : action === 'COMPLETE'
              ? 'Complete the setup checklist before finishing onboarding'
              : 'Set a valid price for each product before continuing',
        );
      }
    }

    const data = {
      ...(action === 'START'
        ? {
            startedAt: existing.startedAt ?? now,
            currentStep: Math.max(existing.currentStep, 1),
          }
        : {}),
      ...(action === 'STOREFRONT_CONFIGURED'
        ? {
            storefrontConfiguredAt: now,
            currentStep: Math.max(existing.currentStep, 1),
          }
        : {}),
      ...(action === 'PRICES_CONFIGURED'
        ? {
            pricesConfiguredAt: now,
            currentStep: Math.max(existing.currentStep, 2),
          }
        : {}),
      ...(action === 'PRODUCTS_REVIEWED'
        ? {
            productsReviewedAt: now,
            currentStep: Math.max(existing.currentStep, 3),
          }
        : {}),
      ...(action === 'STOREFRONT_SHARED'
        ? {
            storefrontSharedAt: now,
            currentStep: Math.max(existing.currentStep, 4),
          }
        : {}),
      ...(action === 'COMPLETE'
        ? {
            completedAt: now,
            storefrontConfiguredAt: existing.storefrontConfiguredAt ?? now,
            pricesConfiguredAt: existing.pricesConfiguredAt ?? now,
            currentStep: 4,
          }
        : {}),
      ...(action === 'DISMISS' ? { lastDismissedAt: now } : {}),
    };

    await this.prisma.agentOnboarding.update({
      where: { agentId },
      data,
    });

    return this.get(agentId);
  }

  private toResponse(
    onboarding: {
      currentStep: number;
      startedAt: Date | null;
      storefrontConfiguredAt: Date | null;
      pricesConfiguredAt: Date | null;
      productsReviewedAt: Date | null;
      storefrontSharedAt: Date | null;
      completedAt: Date | null;
      lastDismissedAt: Date | null;
    } | null,
    prices: Awaited<ReturnType<PricingService['listForAgent']>>,
    storefront: Awaited<ReturnType<SalesChannelService['getForAgent']>>,
  ) {
    const pricesConfigured =
      prices.length > 0 &&
      prices.every((row) => row.pricing.retailPriceMinor !== null);
    const storefrontConfigured = Boolean(
      storefront.storeName?.trim() && storefront.slug?.trim(),
    );
    const productsReviewed = Boolean(onboarding?.productsReviewedAt);
    const storefrontShared = Boolean(onboarding?.storefrontSharedAt);
    const completed = Boolean(onboarding?.completedAt);
    const completedCount = [
      storefrontConfigured,
      pricesConfigured,
      productsReviewed,
      storefrontShared,
    ].filter(Boolean).length;

    return {
      status: completed
        ? 'COMPLETED'
        : onboarding?.startedAt
          ? 'IN_PROGRESS'
          : 'NOT_STARTED',
      currentStep: onboarding?.currentStep ?? 0,
      completedCount,
      totalSteps: 4,
      startedAt: onboarding?.startedAt ?? null,
      completedAt: onboarding?.completedAt ?? null,
      lastDismissedAt: onboarding?.lastDismissedAt ?? null,
      steps: [
        {
          id: 'store',
          title: 'Name your store and link',
          description:
            'Give buyers a clear store name and an easy-to-share web link.',
          complete: storefrontConfigured,
        },
        {
          id: 'prices',
          title: 'Set your prices',
          description:
            'Choose what buyers pay and see your profit per checker.',
          complete: pricesConfigured,
        },
        {
          id: 'products',
          title: 'Review availability',
          description: 'Check which products are ready to sell today.',
          complete: productsReviewed,
        },
        {
          id: 'share',
          title: 'Share your store link',
          description: 'Copy your finished link and start reaching buyers.',
          complete: storefrontShared,
        },
      ],
      prices,
      storefront: {
        url: storefront.subdomainUrl,
        storeName: storefront.storeName,
        slug: storefront.slug,
        webSalesId: storefront.webSalesId,
      },
    };
  }
}
