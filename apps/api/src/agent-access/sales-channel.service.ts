import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AgentStatus, ProductStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { UpdateStorefrontRequest } from './dto/update-storefront.request';

const RESERVED_SLUGS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'auth',
  'dashboard',
  'recover',
  'static',
  'assets',
  'waec',
  'bece',
  'wassce',
  'doraf',
  'paystack',
  'support',
  'official',
  'help',
]);

@Injectable()
export class SalesChannelService {
  constructor(private readonly prisma: PrismaService) {}

  async getForAgent(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        webSalesId: true,
        slug: true,
        storeName: true,
        tagline: true,
        logoUrl: true,
        bannerUrl: true,
        whatsappNumber: true,
        themePreset: true,
        announcement: true,
      },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    const publicId = agent.slug || agent.webSalesId;
    return {
      type: 'WEB' as const,
      publicId,
      slug: agent.slug,
      webSalesId: agent.webSalesId,
      path: `/buy/${agent.webSalesId}`,
      subdomainUrl: this.getSubdomainUrl(publicId),
      storeName: agent.storeName,
      tagline: agent.tagline,
      logoUrl: agent.logoUrl,
      bannerUrl: agent.bannerUrl,
      whatsappNumber: agent.whatsappNumber,
      themePreset: agent.themePreset || 'default',
      announcement: agent.announcement,
    };
  }

  private getSubdomainUrl(publicId: string): string {
    const rawUrl = process.env.DORAF_STOREFRONT_URL || 'http://localhost:3003';
    try {
      const url = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
      const protocol = url.protocol || 'https:';
      const hostname = url.hostname;
      const port = url.port ? `:${url.port}` : '';
      const isLocal =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.localhost');
      if (isLocal) {
        return `${protocol}//${publicId}.localhost${port}`;
      }
      const rootDomain = hostname.split('.').slice(-2).join('.');
      return `${protocol}//${publicId}.${rootDomain}`;
    } catch {
      return `https://${publicId}.doraf.app`;
    }
  }

  async resolveWebChannel(identifier: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { OR: [{ webSalesId: identifier }, { slug: identifier }] },
      select: {
        name: true,
        status: true,
        webSalesId: true,
        slug: true,
        storeName: true,
        tagline: true,
        logoUrl: true,
        bannerUrl: true,
        whatsappNumber: true,
        themePreset: true,
        announcement: true,
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

    const publicId = agent.slug || agent.webSalesId;

    return {
      channel: {
        type: 'WEB' as const,
        publicId,
        slug: agent.slug,
        webSalesId: agent.webSalesId,
      },
      agent: {
        displayName: agent.name,
        storeName: agent.storeName || agent.name,
        tagline: agent.tagline,
        logoUrl: agent.logoUrl,
        bannerUrl: agent.bannerUrl,
        whatsappNumber: agent.whatsappNumber,
        themePreset: agent.themePreset || 'default',
        announcement: agent.announcement,
      },
      products: agent.productPrices.map((price) => ({
        ...price.product,
        retailPriceMinor: Number(price.retailPriceMinor),
        currency: price.currency.trim(),
      })),
    };
  }

  async updateStorefront(agentId: string, input: UpdateStorefrontRequest) {
    const existing = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, slug: true },
    });
    if (!existing) throw new NotFoundException('Agent not found');

    if (input.slug !== undefined && input.slug !== existing.slug) {
      const normalizedSlug = input.slug.trim().toLowerCase();
      if (RESERVED_SLUGS.has(normalizedSlug)) {
        throw new BadRequestException(`Slug '${normalizedSlug}' is reserved.`);
      }
      const duplicate = await this.prisma.agent.findUnique({
        where: { slug: normalizedSlug },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== agentId) {
        throw new ConflictException(
          `Slug '${normalizedSlug}' is already taken by another merchant.`,
        );
      }
      input.slug = normalizedSlug;
    }

    await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        ...(input.slug !== undefined ? { slug: input.slug || null } : {}),
        ...(input.storeName !== undefined ? { storeName: input.storeName || null } : {}),
        ...(input.tagline !== undefined ? { tagline: input.tagline || null } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl || null } : {}),
        ...(input.bannerUrl !== undefined ? { bannerUrl: input.bannerUrl || null } : {}),
        ...(input.whatsappNumber !== undefined
          ? { whatsappNumber: input.whatsappNumber || null }
          : {}),
        ...(input.themePreset !== undefined ? { themePreset: input.themePreset } : {}),
        ...(input.announcement !== undefined
          ? { announcement: input.announcement || null }
          : {}),
      },
    });

    return this.getForAgent(agentId);
  }
}

