import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PRODUCT_REPOSITORY } from './catalog.types';
import { PrismaProductRepository } from './prisma-product.repository';

@Module({
  controllers: [CatalogController],
  providers: [
    CatalogService,
    {
      provide: PRODUCT_REPOSITORY,
      useClass: PrismaProductRepository,
    },
  ],
})
export class CatalogModule {}
