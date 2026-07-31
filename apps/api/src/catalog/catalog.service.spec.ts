import { CatalogService } from './catalog.service';
import type { ProductRepository } from './catalog.types';

describe('CatalogService', () => {
  it('delegates available-product selection to the repository', async () => {
    const product = {
      code: 'BECE',
      name: 'BECE Checker',
      scopeDisclosure: 'BECE School and Private results.',
      disclosureVersion: 1,
    };
    const findAvailable = jest.fn().mockResolvedValue([product]);
    const repository: ProductRepository = { findAvailable };
    const service = new CatalogService(repository);

    await expect(service.listAvailableProducts()).resolves.toEqual([product]);
    expect(findAvailable).toHaveBeenCalledTimes(1);
  });
});
