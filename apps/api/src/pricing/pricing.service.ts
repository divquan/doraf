import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

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
