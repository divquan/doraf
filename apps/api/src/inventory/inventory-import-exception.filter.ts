import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  InventoryDuplicateConflictError,
  InventoryImportValidationError,
  InventoryProductNotFoundError,
} from './inventory.errors';

@Catch(
  InventoryImportValidationError,
  InventoryProductNotFoundError,
  InventoryDuplicateConflictError,
)
export class InventoryImportExceptionFilter implements ExceptionFilter {
  catch(
    exception:
      | InventoryImportValidationError
      | InventoryProductNotFoundError
      | InventoryDuplicateConflictError,
    host: ArgumentsHost,
  ): void {
    const response = host.switchToHttp().getResponse<Response>();
    const mapped = this.mapException(exception);
    response.status(mapped.getStatus()).json(mapped.getResponse());
  }

  private mapException(
    exception:
      | InventoryImportValidationError
      | InventoryProductNotFoundError
      | InventoryDuplicateConflictError,
  ): BadRequestException | NotFoundException | ConflictException {
    if (exception instanceof InventoryImportValidationError) {
      return new BadRequestException({
        code: 'INVENTORY_IMPORT_INVALID',
        message: exception.message,
        errors: exception.errors,
      });
    }
    if (exception instanceof InventoryProductNotFoundError) {
      return new NotFoundException({
        code: 'INVENTORY_PRODUCT_NOT_FOUND',
        message: exception.message,
      });
    }
    return new ConflictException({
      code: 'INVENTORY_DUPLICATE_CONFLICT',
      message: exception.message,
    });
  }
}
