import { Expose } from 'class-transformer';

export class CatalogProductResponse {
  @Expose()
  code!: string;

  @Expose()
  name!: string;

  @Expose()
  scopeDisclosure!: string;

  @Expose()
  disclosureVersion!: number;
}
