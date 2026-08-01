import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentStatus, ProductStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SalesChannelService {
  constructor(private readonly prisma: PrismaService) {}

  async getForAgent(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { webSalesId: true },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    return {
      type: 'WEB' as const,
      publicId: agent.webSalesId,
      path: `/buy/${agent.webSalesId}`,
    };
  }

  async resolveWebChannel(webSalesId: string) {
    if (!/^[a-f0-9]{24}$/.test(webSalesId)) {
      throw new NotFoundException('Sales channel not found');
    }
    const agent = await this.prisma.agent.findUnique({
      where: { webSalesId },
      select: {
        name: true,
        status: true,
        productPrices: {
          where: { product: { status: ProductStatus.ACTIVE } },
          orderBy: { product: { displayOrder: 'asc' } },
          select: {
            retailPriceMinor: true,
            currency: true,
            product: {
              select: {
                id: true,
                code: true,
                name: true,
                scopeDisclosure: true,
                status: true,
              },
            },
          },
        },
      },
    });
    if (!agent || agent.status !== AgentStatus.ACTIVE) {
      throw new NotFoundException('Sales channel not found');
    }
    return {
      channel: { type: 'WEB' as const, publicId: webSalesId },
      agent: { displayName: agent.name },
      products: agent.productPrices.map((price) => ({
        ...price.product,
        retailPriceMinor: Number(price.retailPriceMinor),
        currency: price.currency.trim(),
      })),
    };
  }
}
