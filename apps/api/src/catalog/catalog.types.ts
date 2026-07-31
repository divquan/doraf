export interface CatalogProduct {
  code: string;
  name: string;
  scopeDisclosure: string;
  disclosureVersion: number;
}

export interface ProductRepository {
  findAvailable(): Promise<CatalogProduct[]>;
}

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
