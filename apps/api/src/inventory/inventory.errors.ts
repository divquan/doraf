import type { InventoryValidationError } from './inventory.types';

export class InventoryProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Inventory product ${productId} was not found`);
    this.name = InventoryProductNotFoundError.name;
  }
}

export class InventoryImportValidationError extends Error {
  constructor(public readonly errors: InventoryValidationError[]) {
    super('Inventory CSV failed validation');
    this.name = InventoryImportValidationError.name;
  }
}

export class InventoryDuplicateConflictError extends Error {
  constructor() {
    super('A voucher serial number or PIN was imported concurrently');
    this.name = InventoryDuplicateConflictError.name;
  }
}
