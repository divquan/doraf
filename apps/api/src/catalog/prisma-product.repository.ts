import { Injectable } from '@nestjs/common';
import { ProductStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { CatalogProduct, ProductRepository } from './catalog.types';

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAvailable(): Promise<CatalogProduct[]> {
    return this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      orderBy: { displayOrder: 'asc' },
      select: {
        code: true,
        name: true,
        scopeDisclosure: true,
        disclosureVersion: true,
      },
    });
  }
}
