import { Controller, Get, SerializeOptions } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CatalogService } from './catalog.service';
import { CatalogProductResponse } from './dto/catalog-product.response';

@Controller('catalog/products')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @SerializeOptions({ type: CatalogProductResponse })
  async listAvailable(): Promise<CatalogProductResponse[]> {
    const products = await this.catalogService.listAvailableProducts();
    return plainToInstance(CatalogProductResponse, products, {
      excludeExtraneousValues: true,
    });
  }
}
