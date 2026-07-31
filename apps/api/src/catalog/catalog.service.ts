import { Inject, Injectable } from '@nestjs/common';
import {
  PRODUCT_REPOSITORY,
  type CatalogProduct,
  type ProductRepository,
} from './catalog.types';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly products: ProductRepository,
  ) {}

  listAvailableProducts(): Promise<CatalogProduct[]> {
    return this.products.findAvailable();
  }
}
